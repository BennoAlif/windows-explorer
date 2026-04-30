import { db } from './index';
import { files, folders } from './schema';

async function seed() {
  console.log('Seeding...');

  // Insert root folders
  const [documents, downloads, pictures] = await db
    .insert(folders)
    .values([
      { name: 'Documents' },
      { name: 'Downloads' },
      { name: 'Pictures' },
    ])
    .returning();

  if (!documents || !downloads || !pictures) {
    throw new Error('Failed to insert root folders');
  }

  // Insert subfolders
  const [work] = await db
    .insert(folders)
    .values([{ name: 'Work', parentId: documents.id }])
    .returning();

  if (!work) {
    throw new Error('Failed to insert subfolder');
  }

  // Insert files
  await db.insert(files).values([
    { name: 'resume.pdf', folderId: documents.id },
    { name: 'notes.txt', folderId: documents.id },
    { name: 'report.docx', folderId: work.id },
    { name: 'installer.exe', folderId: downloads.id },
    { name: 'photo.png', folderId: pictures.id },
  ]);

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
