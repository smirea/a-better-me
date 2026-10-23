import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
src, out = sys.argv[1], sys.argv[2]
specs = [
    ("DMSans.ttf", "DM Sans", [("Regular", 400), ("Medium", 500), ("SemiBold", 600), ("Bold", 700)], {"opsz": 14}),
    ("MacroSans.ttf", "MacroSans Display", [("Black", 800)], {"wdth": 200}),
]
files = {"DMSans.ttf": f"{src}/DMSans-VariableFont_opsz,wght.ttf", "MacroSans.ttf": f"{src}/MacroSans-VF.ttf"}
for key, family, styles, extra in specs:
    for style, weight in styles:
        font = instantiateVariableFont(TTFont(files[key]), {"wght": weight, **extra})
        ps = f"{family.replace(' ', '')}-{style}"
        name = font["name"]
        for rec in list(name.names):
            if rec.nameID in (16, 17, 21, 22, 25):
                name.removeNames(nameID=rec.nameID)
        for nid, value in {1: family, 2: "Regular", 3: ps, 4: f"{family} {style}", 6: ps}.items():
            name.setName(value, nid, 3, 1, 0x409)
            name.setName(value, nid, 1, 0, 0)
        name.setName(family, 16, 3, 1, 0x409)
        name.setName(style, 17, 3, 1, 0x409)
        font["OS/2"].usWeightClass = weight
        font.save(f"{out}/{ps}.ttf")
        print(ps)
