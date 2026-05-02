import { check, sleep } from "k6";
import http from "k6/http";

const profile = __ENV.K6_PROFILE ?? "baseline";
const baseUrl = (__ENV.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const searchTerms = (__ENV.SEARCH_TERMS ?? "perf-file,perf-folder,perf-root")
	.split(",")
	.map((term) => term.trim())
	.filter(Boolean);

const intEnv = (name, fallback) => {
	const value = Number(__ENV[name] ?? fallback);
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

const stagesByProfile = {
	smoke: [
		{
			duration: __ENV.SMOKE_RAMP_DURATION ?? "10s",
			target: intEnv("SMOKE_VUS", 2),
		},
		{
			duration: __ENV.SMOKE_HOLD_DURATION ?? "20s",
			target: intEnv("SMOKE_VUS", 2),
		},
		{ duration: "10s", target: 0 },
	],
	baseline: [
		{
			duration: __ENV.RAMP_UP_DURATION ?? "1m",
			target: intEnv("TARGET_VUS", 50),
		},
		{ duration: __ENV.HOLD_DURATION ?? "3m", target: intEnv("TARGET_VUS", 50) },
		{ duration: __ENV.RAMP_DOWN_DURATION ?? "1m", target: 0 },
	],
};

export const options = {
	stages: stagesByProfile[profile] ?? stagesByProfile.baseline,
	thresholds: {
		http_req_failed: ["rate<0.01"],
		http_req_duration: [`p(95)<${intEnv("P95_MS", 2000)}`],
		checks: ["rate>0.99"],
	},
};

const jsonHeaders = {
	headers: {
		"Content-Type": "application/json",
	},
};

const parseJson = (response) => {
	try {
		return response.json();
	} catch (_) {
		return null;
	}
};

const expectOk = (response, name) =>
	check(response, {
		[`${name}: status is 2xx`]: (res) => res.status >= 200 && res.status < 300,
		[`${name}: api success`]: (res) => parseJson(res)?.success === true,
	});

const dataItems = (response) => parseJson(response)?.data?.items ?? [];
const data = (response) => parseJson(response)?.data ?? null;

const uniqueName = (prefix) =>
	`k6-${prefix}-vu${__VU}-iter${__ITER}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}`;

const cleanup = (method, path) => {
	const response = http.request(method, `${baseUrl}${path}`);
	check(response, {
		[`cleanup ${method} ${path}: status is 2xx or 404`]: (res) =>
			(res.status >= 200 && res.status < 300) || res.status === 404,
	});
};

export default function () {
	const rootResponse = http.get(`${baseUrl}/v1/folders?limit=100`);
	expectOk(rootResponse, "list root folders");

	const roots = dataItems(rootResponse);
	const root = roots.length
		? roots[Math.floor(Math.random() * roots.length)]
		: null;

	if (root?.id) {
		const itemsResponse = http.get(
			`${baseUrl}/v1/folders/${root.id}/items?limit=100`,
		);
		expectOk(itemsResponse, "open folder items");
	}

	const searchTerm = searchTerms[__ITER % searchTerms.length] ?? "perf";
	const searchResponse = http.get(
		`${baseUrl}/v1/search?q=${encodeURIComponent(searchTerm)}&limit=100`,
	);
	expectOk(searchResponse, "search seeded data");

	let sourceFolderId = null;
	let destinationFolderId = null;
	let fileId = null;

	const sourceFolderResponse = http.post(
		`${baseUrl}/v1/folders`,
		JSON.stringify({ name: uniqueName("source") }),
		jsonHeaders,
	);
	expectOk(sourceFolderResponse, "create source folder");
	sourceFolderId = data(sourceFolderResponse)?.id ?? null;

	if (!sourceFolderId) return;

	const destinationFolderResponse = http.post(
		`${baseUrl}/v1/folders`,
		JSON.stringify({ name: uniqueName("destination") }),
		jsonHeaders,
	);
	expectOk(destinationFolderResponse, "create destination folder");
	destinationFolderId = data(destinationFolderResponse)?.id ?? null;

	try {
		const fileResponse = http.post(
			`${baseUrl}/v1/folders/${sourceFolderId}/files`,
			JSON.stringify({ name: `${uniqueName("file")}.txt` }),
			jsonHeaders,
		);
		expectOk(fileResponse, "create file");
		fileId = data(fileResponse)?.id ?? null;

		if (fileId && destinationFolderId) {
			const moveFileResponse = http.patch(
				`${baseUrl}/v1/files/${fileId}`,
				JSON.stringify({
					name: `${uniqueName("renamed-file")}.txt`,
					folderId: destinationFolderId,
				}),
				jsonHeaders,
			);
			expectOk(moveFileResponse, "rename and move file");
		}

		const renameFolderResponse = http.patch(
			`${baseUrl}/v1/folders/${sourceFolderId}`,
			JSON.stringify({ name: uniqueName("renamed-folder") }),
			jsonHeaders,
		);
		expectOk(renameFolderResponse, "rename folder");
	} finally {
		if (fileId) cleanup("DELETE", `/v1/files/${fileId}`);
		if (sourceFolderId) cleanup("DELETE", `/v1/folders/${sourceFolderId}`);
		if (destinationFolderId)
			cleanup("DELETE", `/v1/folders/${destinationFolderId}`);
	}

	sleep(Number(__ENV.SLEEP_SECONDS ?? 1));
}
