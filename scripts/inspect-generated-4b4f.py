import pikepdf

path = r"C:/Users/bratn/Downloads/4b4f480a-97cf-41ee-b606-5448bfd7fa79.pdf"
pdf = pikepdf.Pdf.open(path)
acro = pdf.Root.get('/AcroForm', None)
print('pages', len(pdf.pages), 'hasAcro', acro is not None)
if not acro:
    raise SystemExit(0)
fields = list(acro.get('/Fields', []))
print('top_fields', len(fields))

by_name = {}
for f in fields:
    n = str(f.get('/T', ''))
    if n:
        by_name[n] = f

checks = [f'Check {i}' for i in range(1,21)]
strikes = [f'Strike{i}' for i in range(1,21)]
print('checks present', sum(1 for n in checks if n in by_name))
print('strikes present', sum(1 for n in strikes if n in by_name))

for n in checks:
    f = by_name.get(n)
    if not f:
        continue
    ws = list(f.get('/Kids', [])) if '/Kids' in f else [f]
    for w in ws[:1]:
        p = w.get('/P', None)
        pidx = -1
        if p is not None:
            for i, pg in enumerate(pdf.pages):
                if pg.obj.objgen == p.objgen:
                    pidx = i
                    break
        r = [float(v) for v in w.get('/Rect', [0,0,0,0])]
        print(f'CHECK {n} page={pidx} y={(r[1]+r[3])/2:.2f} x={r[0]:.2f} V={f.get("/V")} F={int(w.get("/F",0))}')

for n in ['Strike9','Strike10','Strike11','Strike12','Strike13','Strike16','Strike17','Strike18','Strike19','Strike20']:
    f = by_name.get(n)
    if not f:
        continue
    ws = list(f.get('/Kids', [])) if '/Kids' in f else [f]
    rows=[]
    missing=0
    for w in ws:
        p = w.get('/P', None)
        if p is None:
            missing += 1
            continue
        pidx=-1
        for i, pg in enumerate(pdf.pages):
            if pg.obj.objgen == p.objgen:
                pidx = i
                break
        r=[float(v) for v in w.get('/Rect', [0,0,0,0])]
        yc=(r[1]+r[3])/2
        rows.append((pidx,yc,r[0],r[2],int(w.get('/F',0))))
    rows.sort(key=lambda x:(x[0],-x[1]))
    print(f'\\n{n}: rows={len(rows)} missingP={missing}')
    for row in rows[:18]:
        print(' ', tuple(round(v,3) if isinstance(v,float) else v for v in row))
