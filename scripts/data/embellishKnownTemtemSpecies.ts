import path from "path";
import cheerio from "cheerio";
import glob from "glob";
import * as log from "../util/log";
import fetchHTML from "../util/fetchHTML";
import { cleanToNumber } from "../util/cleaners";
import { isElementTagNameNot, typedToArray } from "../util/cheerioHelpers";
import { Temtem as MinimalTemtem } from "./getKnownTemtemSpecies";

export enum TechniqueSource {
  LEVELLING = "Levelling",
  TRAINING_COURSE = "TechniqueCourses",
  BREEDING = "Breeding",
}

export enum TemtemEvolutionType {
  LEVEL = "level",
  SPECIAL = "special",
}

export interface TemtemTechnique {
  name: string;
  source: TechniqueSource;
}

export interface TemtemLocation {
  location: string;
  place: string;
  note: string;
  island: string;
  frequency: string;
  level: string;
  freetem: TemtemLocationFreetem;
}

export interface TemtemLocationFreetem {
  minLevel: number;
  maxLevel: number;
  minPansuns: number;
  maxPansuns: number;
}

export interface TemtemEvolutionTree {
  number: number;
  name: string;
  stage: number;
}

export interface TemtemEvolution {
  stage?: number;
  evolutionTree?: TemtemEvolutionTree[];
  evolves?: true;
  type: TemtemEvolutionType;
  description?: string;
}

export interface TemtemNoEvolution {
  evolves: false;
}

export interface Temtem extends MinimalTemtem {
  traits: string[];
  hasAnySubspeciesType: boolean;
  details: {
    height: {
      cm: number;
      inches: number;
    };
    weight: {
      kg: number;
      lbs: number;
    };
  };
  techniques: TemtemTechnique[];
  trivia: string[];
  evolution: TemtemEvolution | TemtemNoEvolution;
  wikiPortraitUrlLarge: string;
  lumaWikiPortraitUrlLarge: string;
  locations: TemtemLocation[];
  icon: string;
  lumaIcon: string;
  genderRatio: {
    male: number;
    female: number;
  };
  catchRate: number;
  hatchMins: number;
  tvYields: Record<keyof Omit<MinimalTemtem["stats"], "total">, number>;
  gameDescription: string;
  wikiRenderStaticUrl: string;
  wikiRenderAnimatedUrl: string;
  wikiRenderStaticLumaUrl: string;
  wikiRenderAnimatedLumaUrl: string;
  wikiRenderStaticUmbraUrl: string;
  wikiRenderAnimatedUmbraUrl: string;
  renderStaticImage: string;
  renderStaticLumaImage: string;
  renderStaticUmbraImage: string;
  renderAnimatedImage: string;
  renderAnimatedLumaImage: string;
  renderAnimatedUmbraImage: string;
}

async function asyncGlob(p: string) {
  return new Promise<string[]>((resolve, reject) => {
    glob(p, (err, matches) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(matches);
      return;
    });
  });
}

export default async function embellishKnownTemtemSpecies(
  ar: MinimalTemtem[]
): Promise<Temtem[] | undefined> {
  log.info(`Embellishing ${ar.length} tems`);
  try {
    const webpages = await fetchHTML("temtem", ar, "name", true);
    const icons = await asyncGlob(
      path.join(
        __dirname,
        "..",
        "..",
        "public",
        "images",
        "portraits",
        "temtem",
        "**/*.png"
      )
    );
    const result = webpages
      .map(({ item, html }) => {
        const name = item.name.split(" ")[0];
        const catchRate = getCatchRate(html);
        const renderedImages = getRenderImages(html, name);
        const icon = `/images/portraits/temtem/large/${name}.png`;
        const lumaIcon = `/images/portraits/temtem/luma/large/${name}.png`;
        return {
          ...item,
          traits: getTraits(html),
          details: getDetails(html),
          hasAnySubspeciesType: hasAnySubspeciesType(html),
          techniques: getTechniques(html),
          trivia: getTrivia(html),
          evolution: getEvolutionInfo(ar, item, html),
          wikiPortraitUrlLarge: getWikiPortraitUrl(html),
          lumaWikiPortraitUrlLarge: getWikiLumaPortraitUrl(html),
          locations: getLocations(html),
          icon: icons.some((i) => i.endsWith(icon)) ? icon : "",
          lumaIcon: icons.some((i) => i.endsWith(lumaIcon)) ? lumaIcon : "",
          genderRatio: getGenderRatio(html),
          catchRate,
          hatchMins: calculateHatchMins(catchRate),
          tvYields: getTvYield(html),
          gameDescription: getGameDescription(html, item),
          wikiRenderStaticUrl: renderedImages.static.normal,
          wikiRenderAnimatedUrl: renderedImages.animated.normal,
          wikiRenderStaticLumaUrl: renderedImages.static.luma,
          wikiRenderAnimatedLumaUrl: renderedImages.animated.luma,
          wikiRenderStaticUmbraUrl: renderedImages.static.umbra,
          wikiRenderAnimatedUmbraUrl: renderedImages.animated.umbra,
          renderStaticImage: renderedImages.static.normal
            ? `/images/renders/temtem/static/${name}.png`
            : "",
          renderStaticLumaImage: renderedImages.static.luma
            ? `/images/renders/temtem/luma/static/${name}.png`
            : "",
          renderStaticUmbraImage: renderedImages.static.umbra
            ? `/images/renders/temtem/umbra/static/${name}.png`
            : "",
          renderAnimatedImage: renderedImages.animated.normal
            ? `/images/renders/temtem/animated/${name}.gif`
            : "",
          renderAnimatedLumaImage: renderedImages.animated.luma
            ? `/images/renders/temtem/luma/animated/${name}.gif`
            : "",
          renderAnimatedUmbraImage: renderedImages.animated.umbra
            ? `/images/renders/temtem/umbra/animated/${name}.gif`
            : "",
        };
      })
      .sort((a, b) => a.number - b.number);
    return result;
  } catch (e) {
    log.error(e);
  }
}

function getRenderImages(html: string, name: string, debug: boolean = false) {
  const $ = cheerio.load(html);
  const staticImages = typedToArray<{
    luma: boolean;
    umbra: boolean;
    url: string;
  }>(
    $(`a[href*=${name}_full_render]`).map((_i, el) => {
      const originalUrl = (
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        ""
      ).replace("/thumb/", "/");
      return {
        luma: ($(el).attr("href") || "").includes(`Luma${name}`),
        umbra: ($(el).attr("href") || "").includes(`Umbra${name}`),
        url: `https://temtem.wiki.gg${originalUrl
          .replace(`/${path.parse(originalUrl).name}`, "")
          .replace(".png.png", ".png")
          .replace(".gif.gif", ".gif")
          .replace(/\/revision\/latest\/scale-to-width.*$/, "")}`,
      };
    })
  ).reduce(
    (acc, { luma, umbra, url }) => ({
      ...acc,
      [luma ? "luma" : umbra ? "umbra" : "normal"]: url,
    }),
    { normal: "", luma: "", umbra: "" }
  );
  if (debug) {
    console.info("static", staticImages);
  }
  const animatedImages = typedToArray<{
    luma: boolean;
    umbra: boolean;
    url: string;
  }>(
    $(`a[href*=${name}_idle_animation]`).map((_i, el) => {
      const originalUrl = (
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        ""
      ).replace("/thumb/", "/");
      return {
        luma: ($(el).attr("href") || "").includes(`Luma${name}`),
        umbra: ($(el).attr("href") || "").includes(`Umbra${name}`),
        url: `https://temtem.wiki.gg${originalUrl
          .replace(`/${path.parse(originalUrl).name}`, "")
          .replace(".png.png", ".png")
          .replace(".gif.gif", ".gif")
          .replace(/\/revision\/latest\/scale-to-width.*$/, "")}`,
      };
    })
  ).reduce(
    (acc, { luma, umbra, url }) => ({
      ...acc,
      [luma ? "luma" : umbra ? "umbra" : "normal"]: url,
    }),
    { normal: "", luma: "", umbra: "" }
  );
  if (debug) {
    console.info("animated", animatedImages);
  }
  return {
    static: {
      normal: staticImages.normal || staticImages.luma,
      luma: staticImages.luma || staticImages.normal,
      umbra: staticImages.umbra || staticImages.normal,
    },
    animated: {
      normal: animatedImages.normal || animatedImages.luma,
      luma: animatedImages.luma || animatedImages.normal,
      umbra: animatedImages.umbra || animatedImages.normal,
    },
  };
}

function calculateHatchMins(catchRate: number) {
  return 40 - catchRate / 5 + 5;
}

function getLocations(html: string, debug?: boolean) {
  const $ = cheerio.load(html);
  const locationHeader = $("#Location");
  let locationTable = $(locationHeader).parent().next();
  if (isElementTagNameNot(locationTable[0], "table", "tagName")) {
    locationTable = $(locationTable).next();
  }
  if (isElementTagNameNot(locationTable[0], "table", "tagName")) {
    return [];
  }
  const locations = typedToArray<TemtemLocation>(
    $(locationTable)
      .find("tbody")
      .first()
      .find("tr")
      .map((_i, row) => {
        const cells = $(row).find("td");
        const item = (cells
          .map((_j, cell) => {
            return $(cell).text().trim();
          })
          .toArray() as unknown) as string[];
        if (debug) {
          console.info("[temtem:location:item]", item);
        }
        // tslint:disable-next-line:strict-type-predicates
        if (item[0] === undefined || item.every((i) => i === "?"))
          return undefined;
        const tidiedLocation = (item[0] || "").replace(
          /([a-z])([A-Z])/g,
          "$1, $2"
        );
        if (tidiedLocation.toLowerCase().startsWith("this table shows")) {
          return undefined;
        }
        return {
          location: tidiedLocation,
          place: "",
          note: "",
          island: item[1],
          frequency: (item[2] || "")
            .replace(/\[\d+\]/, "")
            .replace("?", "")
            .trim(),
          level: (item[3] || "")
            .replace(/\[\d+\]/, "")
            .replace("?", "")
            .trim(),
          freetem: {
            minLevel: 0,
            maxLevel: 0,
            minPansuns: 0,
            maxPansuns: 0,
          },
        };
      })
  );
  return locations;
}

function getWikiPortraitUrl(html: string) {
  const $ = cheerio.load(html);
  return `https://temtem.wiki.gg${(
    $("#mw-content-text .infobox-table #ttw-temtem img").first().data("src") ||
    $("#mw-content-text .infobox-table #ttw-temtem img").first().attr("src") ||
    ""
  ).replace(/\/revision\/latest\/scale-to-width.*$/, "")}`;
}

function getWikiLumaPortraitUrl(html: string) {
  const $ = cheerio.load(html);
  return `https://temtem.wiki.gg${(
    $("#mw-content-text .infobox-table #ttw-temtem-luma img")
      .first()
      .data("src") ||
    $("#mw-content-text .infobox-table #ttw-temtem-luma img")
      .first()
      .attr("src") ||
    ""
  ).replace(/\/revision\/latest\/scale-to-width.*$/, "")}`;
}

function getCatchRate(html: string) {
  const $ = cheerio.load(html);
  const catchRate = $(".infobox-row-name")
    .filter((_i, el) => {
      return $(el).text().trim().toLowerCase() === "catch rate";
    })
    .parent()
    .find(".infobox-row-value")
    .last()
    .text()
    .trim();
  return isNaN(parseInt(catchRate, 10)) ? 200 : parseInt(catchRate, 10);
}

function getTvYield(html: string) {
  const $ = cheerio.load(html);
  const yields = ($(".tv-table tr")
    .last()
    .find("td")
    .map((_, el) => parseInt($(el).text().trim(), 10) || 0)
    .toArray() as unknown) as number[];
  return {
    hp: yields[0],
    sta: yields[1],
    spd: yields[2],
    atk: yields[3],
    def: yields[4],
    spatk: yields[5],
    spdef: yields[6],
  };
}

function getGenderRatio(html: string) {
  const $ = cheerio.load(html);
  const catchRate = $(".infobox-row-name")
    .filter((_i, el) => {
      return $(el).text().trim().toLowerCase() === "gender ratio";
    })
    .parent()
    .find(".infobox-row-value")
    .last()
    .text()
    .trim();
  const maleRatio = catchRate.match(/(\d+)% male/);
  const femaleRatio = catchRate.match(/(\d+)% female/);
  return {
    male:
      maleRatio && maleRatio.length === 2 && !isNaN(parseInt(maleRatio[1], 10))
        ? parseInt(maleRatio[1], 10)
        : 50,
    female:
      femaleRatio &&
      femaleRatio.length === 2 &&
      !isNaN(parseInt(femaleRatio[1], 10))
        ? parseInt(femaleRatio[1], 10)
        : 50,
  };
}

function getTraits(html: string) {
  const $ = cheerio.load(html);
  const $traitInfo = $(".infobox-row")
    .filter((_i, el) => {
      return !!$(el).text().includes("Traits");
    })
    .first()
    .find(".infobox-row-value")
    .last();
  return typedToArray<string>(
    $traitInfo.find("a").map((_i, el) => $(el).text().trim())
  );
}

function hasAnySubspeciesType(html: string) {
  const $ = cheerio.load(html);
  return $("#Subspecies_Variations").length != 0;
}

function getDetails(html: string) {
  const $ = cheerio.load(html);
  const heightInfo = $(".infobox-half-row")
    .filter((_i, el) => {
      return !!$(el).text().includes("Height");
    })
    .first()
    .find(".infobox-row-value")
    .last()
    .text();
  const weightInfo = $(".infobox-half-row")
    .filter((_i, el) => {
      return !!$(el).text().includes("Weight");
    })
    .first()
    .find(".infobox-row-value")
    .last()
    .text();
  return {
    height: {
      cm: cleanToNumber(getDetailSafely(heightInfo, "cm", 0)),
      inches: cleanToNumber(getDetailSafely(heightInfo, '"', 1)),
    },
    weight: {
      kg: cleanToNumber(getDetailSafely(weightInfo, "kg", 0)),
      lbs: cleanToNumber(getDetailSafely(weightInfo, "lbs", 1)),
    },
  };
}

function getDetailSafely(str: string, key: string, i: number) {
  if (!str.includes(key)) return 0;
  try {
    return parseInt(str.split("/")[i], 10);
  } catch {
    return 0;
  }
}

function getTechniques(html: string) {
  const $ = cheerio.load(html);
  const techniques: any[] = [];

  // The ids for the various tables are on span elements nested in h3 elements. The table is always after the h3.
  const levelTechniques = getTechniquesFromTable(
    $,
    $("#By_Leveling_up").parent().next().get(0),
    TechniqueSource.LEVELLING
  );
  const tcTechniques = getTechniquesFromTable(
    $,
    $("#By_Technique_Course").parent().next().get(0),
    TechniqueSource.TRAINING_COURSE
  );
  const eggTechniques = getTechniquesFromTable(
    $,
    $("#By_breeding").parent().next().get(0),
    TechniqueSource.BREEDING
  );

  techniques.push(...levelTechniques);
  techniques.push(...tcTechniques);
  techniques.push(...eggTechniques);

  return techniques;
}

function getTechniqueTableType(caption: string) {
  if (!caption.startsWith("List of Techniques")) return undefined;
  if (caption.includes("Leveling")) {
    return TechniqueSource.LEVELLING;
  } else if (caption.includes("Courses")) {
    return TechniqueSource.TRAINING_COURSE;
  } else if (caption.includes("Breeding")) {
    return TechniqueSource.BREEDING;
  } else {
    return undefined;
  }
}

function getGameDescription(html: string, _item: MinimalTemtem) {
  const $ = cheerio.load(html);
  let potentialEl = $("#Description").parent().next();
  if (isElementTagNameNot(potentialEl[0], "table")) {
    potentialEl = $(potentialEl).next();
  }
  let text = "";
  if (isElementTagNameNot(potentialEl[0], "table")) {
    text = "";
  } else {
    text = $(potentialEl).find("i").text().trim();
  }
  const gameDesc =
    text || $("#Tempedia").parent().next().text().trim() || "N/A";
  return gameDesc;
}

function getTechniquesFromTable(
  $: cheerio.Root,
  table: cheerio.Element,
  type: ReturnType<typeof getTechniqueTableType>
) {
  return $(table)
    .find("tbody>tr")
    .map((i, el) => {
      if (i === 0) return undefined;
      const techniqueName = $(el).find("td").eq(1).text().trim();
      const data =
        !techniqueName || techniqueName === "?"
          ? undefined
          : { name: techniqueName, source: type };
      if (data && type === "Levelling") {
        const levels = parseInt($(el).find("td").eq(0).text().trim(), 10);
        (data as any).levels = isNaN(levels) ? 0 : levels;
      }
      return data;
    })
    .toArray()
    .filter(Boolean);
}

function getTrivia(html: string) {
  const $ = cheerio.load(html);
  const trivia = typedToArray<string>(
    $("#Trivia")
      .parent()
      .next()
      .find("li")
      .map((_i, el) =>
        $(el).text().replace(/\[.\]/g, "").replace(/\\/g, "").trim()
      )
  );
  return trivia;
}

function getEvolutionInfo(
  items: MinimalTemtem[],
  item: any,
  html: string
): any {
  const $ = cheerio.load(html);
  const table = $(".evobox-container");

  let lastLevel = 0;
  let type = "levels";
  let description;
  let stage = 0;
  let stageCount = 0;
  let evolutionTree: any[] = [];

  table.children().each((i, el) => {
    if ($(el).hasClass("evobox")) {
      if ($(el).hasClass("selected")) {
        stage = stageCount;
      }
      const traits = $(el)
        .find(".evobox-trait")
        .map((j, ele) => $(ele).text().trim())
        .toArray();
      const name = $(el).find(".evobox-name").text().trim();
      evolutionTree.push({
        stage: stageCount,
        number: items.find(({ name: n }) => n === name)?.number,
        name,
        level: lastLevel,
        type,
        trading: type === "trade",
        traits,
        description,
      });
      stageCount++;
    } else {
      const $el = $(el);
      $(el).find("br").replaceWith(" ");
      const text = $el.text().trim();
      const currentType =
        text === "Trade"
          ? "trade"
          : isNaN(parseInt(text, 10))
          ? "special"
          : "levels";
      lastLevel = currentType === "levels" ? parseInt(text, 10) : 0;
      type = currentType;
      description = currentType === "special" ? text : undefined;
    }
  });

  evolutionTree = evolutionTree.map((e, i) => ({
    ...e,
    traitMapping: e.traits.reduce(
      (acc, t, j) => ({ ...acc, [t]: (evolutionTree[i + 1] || e).traits[j] }),
      {}
    ),
  }));

  let evoData = { evolves: false };

  if (evolutionTree && evolutionTree.length > 1) {
    evoData = {
      stage,
      evolutionTree,
      evolves: true,
      type: evolutionTree[stage].type,
      from: evolutionTree[stage - 1] || null,
      to: evolutionTree[stage + 1] || null,
      ...evolutionTree[stage],
    };
  }

  return evoData;
}
