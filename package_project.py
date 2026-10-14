"""Build a portable download, excluding hosting identity and recursive ZIPs."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent
(root/'dist/report.js').write_text((root/'dist/data.js').read_text(encoding='utf-8-sig')+'\n'+(root/'dist/app.js').read_text(encoding='utf-8-sig'),encoding='utf-8')
target = root/'dist/startup-lab-source.zip'
with ZipFile(target,'w',ZIP_DEFLATED) as z:
    for p in sorted(root.rglob('*')):
        if not p.is_file() or any(part in {'.git','.openai','.venv','__pycache__'} for part in p.relative_to(root).parts):
            continue
        if p.suffix == '.zip' or p.name == 'run.log':
            continue
        z.write(p, 'startup-lab/'+str(p.relative_to(root)))
print(f'Packaged: {target.name} ({target.stat().st_size:,} bytes)')
