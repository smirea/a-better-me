"""Read an MF .xlsx export into rows of strings (stdlib only). Usage: python3 xlsx.py file.xlsx [--tsv]"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_sheets(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    targets = {r.get('Id'): r.get('Target') for r in rels}
    sheets = {}
    for s in wb.find('m:sheets', NS):
        rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        root = ET.fromstring(z.read('xl/' + targets[rid].lstrip('/').removeprefix('xl/')))
        rows = []
        for row in root.iter('{%s}row' % NS['m']):
            cells = {}
            for c in row.findall('m:c', NS):
                v = c.find('m:v', NS)
                if c.get('t') == 's' and v is not None:
                    val = shared[int(v.text)]
                elif c.get('t') == 'inlineStr':
                    val = ''.join(t.text or '' for t in c.iter('{%s}t' % NS['m']))
                else:
                    val = v.text if v is not None else ''
                cells[col_index(c.get('r'))] = val
            width = max(cells) + 1 if cells else 0
            rows.append([cells.get(i, '') for i in range(width)])
        sheets[s.get('name')] = rows
    return sheets


if __name__ == '__main__':
    for name, rows in read_sheets(sys.argv[1]).items():
        print(f'## sheet {name} ({len(rows)} rows)')
        for r in rows:
            print('\t'.join(r))
