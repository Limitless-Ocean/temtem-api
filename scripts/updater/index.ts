import path from "path";
import getGit, { getStagedDataFiles } from "../util/git";
import * as log from "../util/log";

(async () => {
  await processFiles("data");
  await processFiles("public");
})().catch(e => {
  log.error(e);
  throw e;
});

async function processFiles(type: "data" | "public") {
  log.info(`Processing ${type} files`);
  const dataGit = getGit(type);
  const dataFiles = await getStagedDataFiles(dataGit, [], type);
  if (dataFiles.length) {
    log.info(`Staging ${type} files`, dataFiles);
    await dataGit.add(dataFiles);
    log.info(`Commiting ${type} files`);
    await dataGit.commit(
      `${type}: 🤖 Automatically updating ${type} files`,
      dataFiles
    );
    await dataGit.push();
  } else {
    log.info(`No safe ${type} changes found, skipping`);
  }
  log.info(`Processed ${type} files`);
}
