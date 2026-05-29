import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const danceStyles = JSON.parse(fs.readFileSync(new URL('../src/data/danceStyles.json', import.meta.url), 'utf8'));

const outDir = path.resolve('exports');
const outXlsxFile = path.join(outDir, 'dance-tags-audit.xlsx');
const outCsvFile = path.join(outDir, 'dance-tags-audit.csv');

const pipe = (items) => (Array.isArray(items) ? items.join('|') : '');
const profileSummary = (profiles) =>
  Array.isArray(profiles)
    ? profiles.map((profile) => `${profile.name}:${pipe(profile.styleTags)}:${pipe(profile.outfitKeywords)}`).join(' || ')
    : '';
const csvEscape = (value) => {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};
const toCsv = (rows) => `\ufeff${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
const all = (key) => [...new Set(danceStyles.flatMap((dance) => dance[key] || []))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
const count = (key) => {
  const map = new Map();
  danceStyles.forEach((dance) => (dance[key] || []).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
};

const sheets = [
  {
    name: 'Dance Tags',
    rows: [
      ['id', 'danceName', 'artist', 'danceType', 'aliases_pipe', 'styleTags_pipe', 'sceneTags_pipe', 'outfitKeywords_pipe', 'avoidKeywords_pipe', 'stageOutfitProfiles', 'stageOutfitSummary', 'reviewNotes'],
      ...danceStyles.map((dance) => [
        dance.id,
        dance.danceName,
        dance.artist,
        dance.danceType,
        pipe(dance.aliases),
        pipe(dance.styleTags),
        pipe(dance.sceneTags),
        pipe(dance.outfitKeywords),
        pipe(dance.avoidKeywords),
        profileSummary(dance.stageOutfitProfiles),
        dance.stageOutfitSummary || '',
        '',
      ]),
    ],
  },
  {
    name: 'Tag Summary',
    rows: [
      ['tagType', 'tag', 'usageCount'],
      ...count('styleTags').map(([tag, usage]) => ['styleTags', tag, usage]),
      ...count('sceneTags').map(([tag, usage]) => ['sceneTags', tag, usage]),
      ...count('outfitKeywords').map(([tag, usage]) => ['outfitKeywords', tag, usage]),
      ...count('avoidKeywords').map(([tag, usage]) => ['avoidKeywords', tag, usage]),
    ],
  },
  {
    name: 'Allowed Tags',
    rows: [
      ['styleTags', ...all('styleTags')],
      ['sceneTags', ...all('sceneTags')],
      ['outfitKeywords', ...all('outfitKeywords')],
      ['avoidKeywords', ...all('avoidKeywords')],
    ],
  },
  {
    name: 'Matching Rules',
    rows: [
      ['rule', 'weight', 'notes'],
      ['styleTags overlap', '+3 each', '商品风格标签与舞蹈风格标签重叠越多，排序越靠前。'],
      ['sceneTags overlap', '+2 each', '商品场景标签与舞蹈场景标签重叠越多，排序越靠前。'],
      ['danceType match', '+2', '商品 danceTags 包含舞蹈类型时加分。'],
      ['bodyTags overlap', '+2 each', '用户身材/动作诉求匹配时加分。'],
      ['budget exact match', '+4', '用户选择预算后，精确匹配加分。'],
      ['keyword in product name', '+2 each', '穿搭关键词命中商品名时加分。'],
      ['avoidKeywords in product name/style', '-6 each', '舞蹈标记不适合的元素会被明显降权，例如性感妈咪风避开蝴蝶结/学院感。'],
      ['style conflict', '-4 each', '性感/妈咪/辣妹/红黑/强势与学院/甜美/元气等冲突风格降权，反向同理。'],
      ['stageOutfitProfiles', 'data priority', '一首歌可维护多个打歌舞台 / MV 造型层级，推荐会聚合 profile 中的风格和单品关键词。'],
    ],
  },
];

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colName(index) {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const body = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${colName(c)}${r + 1}`;
      if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${body}</sheetData></worksheet>`;
}

const files = new Map();
files.set('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
files.set('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
files.set('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
files.set('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`);
sheets.forEach((sheet, i) => files.set(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet.rows)));

function dosTimeDate(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosTimeDate();
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = zlib.crc32 ? zlib.crc32(data) : crc32(data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), nameBuf, data]);
    localParts.push(local);
    const central = Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuf]);
    centralParts.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.size), u16(entries.size), u32(central.length), u32(offset), u16(0)]);
  return Buffer.concat([...localParts, central, end]);
}

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outXlsxFile, makeZip(files));
fs.writeFileSync(outCsvFile, toCsv(sheets[0].rows));
console.log(`Exported ${danceStyles.length} dances to ${outXlsxFile}`);
console.log(`Exported editable CSV mirror to ${outCsvFile}`);
