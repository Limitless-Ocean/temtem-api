import throat from "throat";
import pipeFile from "../util/pipeFile";
import * as log from "../util/log";
import { Temtem } from "../data/embellishKnownTemtemSpecies";

const knownTems: Temtem[] = require("../../data/knownTemtemSpecies.json");

const CONCURRENCY_LIMIT = 5;

export default async function getRenders() {
  log.info("Starting");
  await Promise.all(
    knownTems.map(
      throat(CONCURRENCY_LIMIT, async (item) => {
        try {
          await Promise.all([
            item.wikiRenderStaticUrl
              ? pipeFile(item.wikiRenderStaticUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "static",
                  `${item.name}.png`,
                ])
              : undefined,
            item.wikiRenderAnimatedUrl
              ? pipeFile(item.wikiRenderAnimatedUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "animated",
                  `${item.name}.gif`,
                ])
              : undefined,
            item.wikiRenderStaticLumaUrl
              ? pipeFile(item.wikiRenderStaticLumaUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "luma",
                  "static",
                  `${item.name}.png`,
                ])
              : undefined,
            item.wikiRenderAnimatedLumaUrl
              ? pipeFile(item.wikiRenderAnimatedLumaUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "luma",
                  "animated",
                  `${item.name}.gif`,
                ])
              : undefined,
            item.wikiRenderStaticUmbraUrl
              ? pipeFile(item.wikiRenderStaticUmbraUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "umbra",
                  "static",
                  `${item.name}.png`,
                ])
              : undefined,
            item.wikiRenderAnimatedUmbraUrl
              ? pipeFile(item.wikiRenderAnimatedUmbraUrl, [
                  "images",
                  "renders",
                  "temtem",
                  "umbra",
                  "animated",
                  `${item.name}.gif`,
                ])
              : undefined,
          ]);
        } catch (e) {
          log.error(e.message);
        }
      })
    )
  );
  log.info("Finished");
}
