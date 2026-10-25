import struct, sys, subprocess, re
path = sys.argv[1]
data = open(path,'rb').read()
out = subprocess.run(['otool','-l',path],capture_output=True,text=True).stdout
segs=[]
for m in re.finditer(r'segname (\S+)\n\s+vmaddr (0x[0-9a-f]+)\n\s+vmsize (0x[0-9a-f]+)\n\s+fileoff (\d+)', out):
    segs.append((m.group(1),int(m.group(2),16),int(m.group(3),16),int(m.group(4))))
def v2o(a):
    for n,va,vs,fo in segs:
        if va<=a<va+vs: return a-va+fo
    return None
def sect(name):
    m=re.search(r'sectname '+name+r'\n\s+segname \S+\n\s+addr (0x[0-9a-f]+)\n\s+size (0x[0-9a-f]+)',out)
    return int(m.group(1),16),int(m.group(2),16)
def i32(o): return struct.unpack_from('<i',data,o)[0]
def u32(o): return struct.unpack_from('<I',data,o)[0]
def cstr(o):
    e=data.index(b'\0',o); return data[o:e]
def rel(o):
    r=i32(o); return o+r if r else None
def ctxname(o, depth=0):
    if o is None or depth>8: return '?'
    flags=u32(o); kind=flags&0x1f
    nm=''
    if kind in (16,17,18,19) or kind==0 or kind==2:
        no=rel(o+8)
        nm=cstr(no).decode('latin1') if no else ''
    if kind==0: return nm
    po=i32(o+4)
    if po==0: return nm
    p=o+4+po
    if po & 1:
        return '?.'+nm
    return ctxname(p,depth+1)+'.'+nm
def typename(o):
    b=b''
    i=o
    while data[i]!=0:
        c=data[i]
        if 1<=c<=0x17:
            if c in (1,):
                t=i+1+i32(i+1)
                b+=ctxname(t).encode()
            else:
                b+=b'<ref>'
            i+=5
        elif 0x18<=c<=0x1f:
            i+=9; b+=b'<ref>'
        else:
            b+=bytes([c]); i+=1
    return b.decode('latin1')
va,size=sect('__swift5_fieldmd')
o=v2o(va); end=o+size
kinds={0:'struct',1:'class',2:'enum',3:'multiPayloadEnum',4:'protocol',5:'classProtocol',6:'objcProtocol',7:'objcClass'}
while o<end:
    tn=rel(o); kind,rsz=struct.unpack_from('<HH',data,o+8); n=u32(o+12)
    name=typename(tn) if tn else '?'
    fields=[]
    for k in range(n):
        r=o+16+k*12
        fl=u32(r); ft=rel(r+4); fnm=rel(r+8)
        fields.append((cstr(fnm).decode('latin1') if fnm else '', typename(ft) if ft else ''))
    print(f"{kinds.get(kind,kind)} {name}")
    for f,t in fields: print(f"    {f}: {t}")
    o+=16+n*rsz
