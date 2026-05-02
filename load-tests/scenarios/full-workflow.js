import { check, sleep } from "k6";
import http from "k6/http";

const profile = __ENV.K6_PROFILE ?? "production";
const baseUrl = (__ENV.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const searchTerms = (__ENV.SEARCH_TERMS ?? "perf-file,perf-folder,perf-root")
	.split(",")
	.map((term) => term.trim())
	.filter(Boolean);

const intEnv = (name, fallback) => {
	const value = Number(__ENV[name] ?? fallback);
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

const baselineStages = [
	{
		duration: __ENV.RAMP_UP_DURATION ?? "1m",
		target: intEnv("TARGET_VUS", 50),
	},
	{ duration: __ENV.HOLD_DURATION ?? "3m", target: intEnv("TARGET_VUS", 50) },
	{ duration: __ENV.RAMP_DOWN_DURATION ?? "1m", target: 0 },
];

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
	production: baselineStages,
	baseline: baselineStages,
	stress: baselineStages,
	"read-heavy": baselineStages,
	"write-heavy": baselineStages,
};

export const options = {
	stages: stagesByProfile[profile] ?? stagesByProfile.production,
	thresholds: {
		http_req_failed: ["rate<0.01"],
		http_req_duration: [`p(95)<${intEnv("P95_MS", 2000)}`],
		"http_req_duration{name:list_root_folders}": [
			`p(95)<${intEnv("LIST_ROOT_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:open_folder_items}": [
			`p(95)<${intEnv("OPEN_FOLDER_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:search_seeded_data}": [
			`p(95)<${intEnv("SEARCH_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:create_folder}": [
			`p(95)<${intEnv("WRITE_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:create_file}": [
			`p(95)<${intEnv("WRITE_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:update_file}": [
			`p(95)<${intEnv("WRITE_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:update_folder}": [
			`p(95)<${intEnv("WRITE_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		"http_req_duration{name:cleanup}": [
			`p(95)<${intEnv("CLEANUP_P95_MS", intEnv("P95_MS", 2000))}`,
		],
		checks: ["rate>0.99"],
	},
};

const tagsFor = (name) => ({ name, profile });

const jsonParams = (name) => ({
	headers: {
		"Content-Type": "application/json",
	},
	tags: tagsFor(name),
});

const requestParams = (name) => ({
	tags: tagsFor(name),
});

const parseJson = (response) => {
	try {
		return response.json();
	} catch (_) {
		return null;
	}
};

const expectOk = (response, name) =>
	check(response, {
		[`${profile} ${name}: status is 2xx`]: (res) =>
			res.status >= 200 && res.status < 300,
		[`${profile} ${name}: api success`]: (res) =>
			parseJson(res)?.success === true,
	});

const dataItems = (response) => parseJson(response)?.data?.items ?? [];
const data = (response) => parseJson(response)?.data ?? null;

const uniqueName = (prefix) =>
	`k6-${prefix}-vu${__VU}-iter${__ITER}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}`;

const cleanup = (method, path) => {
	const response = http.request(
		method,
		`${baseUrl}${path}`,
		null,
		requestParams("cleanup"),
	);
	check(response, {
		[`${profile} cleanup ${method} ${path}: status is 2xx or 404`]: (res) =>
			(res.status >= 200 && res.status < 300) || res.status === 404,
	});
};

const listRootFolders = () => {
	const response = http.get(
		`${baseUrl}/v1/folders?limit=100`,
		requestParams("list_root_folders"),
	);
	expectOk(response, "list root folders");
	return dataItems(response);
};

const openRandomRootFolder = (roots) => {
	const root = roots.length
		? roots[Math.floor(Math.random() * roots.length)]
		: null;

	if (!root?.id) return;

	const response = http.get(
		`${baseUrl}/v1/folders/${root.id}/items?limit=100`,
		requestParams("open_folder_items"),
	);
	expectOk(response, "open folder items");
};

const browseWorkflow = () => {
	const roots = listRootFolders();
	openRandomRootFolder(roots);
};

const searchWorkflow = () => {
	const searchTerm = searchTerms[__ITER % searchTerms.length] ?? "perf";
	const response = http.get(
		`${baseUrl}/v1/search?q=${encodeURIComponent(searchTerm)}&limit=100`,
		requestParams("search_seeded_data"),
	);
	expectOk(response, "search seeded data");
};

const writeWorkflow = () => {
	let sourceFolderId = null;
	let destinationFolderId = null;
	let fileId = null;

	const sourceFolderResponse = http.post(
		`${baseUrl}/v1/folders`,
		JSON.stringify({ name: uniqueName("source") }),
		jsonParams("create_folder"),
	);
	expectOk(sourceFolderResponse, "create source folder");
	sourceFolderId = data(sourceFolderResponse)?.id ?? null;

	if (!sourceFolderId) return;

	const destinationFolderResponse = http.post(
		`${baseUrl}/v1/folders`,
		JSON.stringify({ name: uniqueName("destination") }),
		jsonParams("create_folder"),
	);
	expectOk(destinationFolderResponse, "create destination folder");
	destinationFolderId = data(destinationFolderResponse)?.id ?? null;

	try {
		const fileResponse = http.post(
			`${baseUrl}/v1/folders/${sourceFolderId}/files`,
			JSON.stringify({ name: `${uniqueName("file")}.txt` }),
			jsonParams("create_file"),
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
				jsonParams("update_file"),
			);
			expectOk(moveFileResponse, "rename and move file");
		}

		const renameFolderResponse = http.patch(
			`${baseUrl}/v1/folders/${sourceFolderId}`,
			JSON.stringify({ name: uniqueName("renamed-folder") }),
			jsonParams("update_folder"),
		);
		expectOk(renameFolderResponse, "rename folder");
	} finally {
		if (fileId) cleanup("DELETE", `/v1/files/${fileId}`);
		if (sourceFolderId) cleanup("DELETE", `/v1/folders/${sourceFolderId}`);
		if (destinationFolderId)
			cleanup("DELETE", `/v1/folders/${destinationFolderId}`);
	}
};

const stressWorkflow = () => {
	browseWorkflow();
	searchWorkflow();
	writeWorkflow();
};

const productionWorkflow = () => {
	const roll = Math.random();
	if (roll < 0.7) {
		browseWorkflow();
		return;
	}

	if (roll < 0.9) {
		searchWorkflow();
		return;
	}

	writeWorkflow();
};

const readHeavyWorkflow = () => {
	if (Math.random() < 0.8) {
		browseWorkflow();
		return;
	}

	searchWorkflow();
};

const workflowByProfile = {
	smoke: productionWorkflow,
	production: productionWorkflow,
	baseline: productionWorkflow,
	stress: stressWorkflow,
	"read-heavy": readHeavyWorkflow,
	"write-heavy": writeWorkflow,
};

export default function () {
	const workflow = workflowByProfile[profile] ?? productionWorkflow;
	workflow();
	sleep(Number(__ENV.SLEEP_SECONDS ?? 1));
}
