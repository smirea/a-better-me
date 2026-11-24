import { Decoder, Stream } from "@garmin/fitsdk";
import type { SeriesPoint } from "../../../shared/garmin/metrics";

const FIT_EPOCH_SECONDS = 631065600;
const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_LOCAL_SIG = 0x04034b50;

export interface ParsedWellnessFit {
  restingHeartRate: number | null;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
  skinTempNightlyC: number | null;
  skinTempDeviationC: number | null;
  sleepScore: number | null;
  heartRate: SeriesPoint[];
  rawStress: SeriesPoint[];
  bodyBattery: SeriesPoint[];
  respiration: SeriesPoint[];
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  void writer.write(copy).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Web-standard ZIP extractor (store & deflate) compatible with both Cloudflare Workers and Bun. */
export async function unzipEntries(zip: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocdOffset = -1;
  for (let i = zip.byteLength - 22; i >= Math.max(0, zip.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === ZIP_EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0)
    throw new Error("Invalid ZIP archive: end-of-central-directory record not found.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const textDecoder = new TextDecoder();
  const entries: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== ZIP_CD_SIG)
      throw new Error("Invalid ZIP central directory header.");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(zip.subarray(offset + 46, offset + 46 + nameLength));

    if (view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_SIG)
      throw new Error(`Invalid local header for ${name}.`);
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);

    entries.push({ name, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function fitTimestampSec(value: unknown): number | null {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number" && Number.isFinite(value))
    return Math.floor(value + FIT_EPOCH_SECONDS);
  return null;
}

function toSortedSeries(map: Map<number, number>): SeriesPoint[] {
  return [...map.entries()].sort(([a], [b]) => a - b);
}

export async function parseWellnessZip(zipBytes: Uint8Array): Promise<ParsedWellnessFit> {
  const entries = (await unzipEntries(zipBytes))
    .filter((e) => e.name.endsWith(".fit"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const heartRate = new Map<number, number>();
  const rawStress = new Map<number, number>();
  const bodyBattery = new Map<number, number>();
  const respiration = new Map<number, number>();

  let restingHeartRate: number | null = null;
  let hrvLastNight: number | null = null;
  let hrvWeeklyAvg: number | null = null;
  let hrvStatus: string | null = null;
  let skinTempNightlyC: number | null = null;
  let skinTempDeviationC: number | null = null;
  let sleepScore: number | null = null;

  for (const entry of entries) {
    const decoder = new Decoder(Stream.fromByteArray(entry.data));
    const { messages } = decoder.read({
      expandSubFields: true,
      convertDateTimesToDates: true,
      includeUnknownData: true,
    }) as unknown as { messages: Record<string, Record<string, unknown>[]> };

    let lastTsSec = fitTimestampSec(messages.monitoringInfoMesgs?.[0]?.timestamp) ?? 0;

    for (const msg of messages.monitoringMesgs ?? []) {
      const full = fitTimestampSec(msg.timestamp);
      if (full != null) {
        lastTsSec = full;
      } else if (typeof msg.timestamp16 === "number" && lastTsSec > 0) {
        const fitSec = lastTsSec - FIT_EPOCH_SECONDS;
        lastTsSec = fitSec + ((msg.timestamp16 - (fitSec & 0xffff)) & 0xffff) + FIT_EPOCH_SECONDS;
      }
      const bpm = msg.heartRate;
      if (typeof bpm === "number" && bpm > 0 && bpm < 255 && lastTsSec > 0) {
        heartRate.set(lastTsSec, Math.round(bpm));
      }
    }

    for (const msg of messages.stressLevelMesgs ?? []) {
      const sec = fitTimestampSec(msg.stressLevelTime);
      if (sec == null) continue;
      const level = msg.stressLevelValue;
      if (typeof level === "number" && level >= 0 && level <= 100)
        rawStress.set(sec, Math.round(level));
      const bb = msg["3"];
      if (typeof bb === "number" && bb >= 0 && bb <= 100) bodyBattery.set(sec, Math.round(bb));
    }

    for (const msg of messages.respirationRateMesgs ?? []) {
      const sec = fitTimestampSec(msg.timestamp);
      const rate = msg.respirationRate;
      if (sec != null && typeof rate === "number" && rate > 0)
        respiration.set(sec, Math.round(rate * 10) / 10);
    }

    for (const msg of messages.monitoringHrDataMesgs ?? []) {
      if (
        typeof msg.currentDayRestingHeartRate === "number" &&
        msg.currentDayRestingHeartRate > 0
      ) {
        restingHeartRate = Math.round(msg.currentDayRestingHeartRate);
      } else if (
        restingHeartRate == null &&
        typeof msg.restingHeartRate === "number" &&
        msg.restingHeartRate > 0
      ) {
        restingHeartRate = Math.round(msg.restingHeartRate);
      }
    }

    for (const msg of messages.hrvStatusSummaryMesgs ?? []) {
      if (typeof msg.lastNightAverage === "number") hrvLastNight = msg.lastNightAverage;
      if (typeof msg.weeklyAverage === "number") hrvWeeklyAvg = msg.weeklyAverage;
      if (typeof msg.status === "string") hrvStatus = msg.status.toLowerCase();
    }

    for (const msg of messages.skinTempOvernightMesgs ?? []) {
      if (typeof msg.nightlyValue === "number")
        skinTempNightlyC = Math.round(msg.nightlyValue * 100) / 100;
      if (typeof msg.averageDeviation === "number")
        skinTempDeviationC = Math.round(msg.averageDeviation * 100) / 100;
    }

    for (const msg of messages.sleepAssessmentMesgs ?? []) {
      if (typeof msg.overallSleepScore === "number") sleepScore = Math.round(msg.overallSleepScore);
    }
  }

  return {
    restingHeartRate,
    hrvLastNight,
    hrvWeeklyAvg,
    hrvStatus,
    skinTempNightlyC,
    skinTempDeviationC,
    sleepScore,
    heartRate: toSortedSeries(heartRate),
    rawStress: toSortedSeries(rawStress),
    bodyBattery: toSortedSeries(bodyBattery),
    respiration: toSortedSeries(respiration),
  };
}
