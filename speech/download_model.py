"""Fetch a versioned model during image build, never during application startup."""
import pathlib
import tempfile
import urllib.request
import zipfile
import shutil
import sys

url = sys.argv[1]
with tempfile.TemporaryDirectory() as temporary:
    archive = pathlib.Path(temporary) / 'model.zip'
    with urllib.request.urlopen(url, timeout=120) as response, archive.open('wb') as output:
        shutil.copyfileobj(response, output)
    with zipfile.ZipFile(archive) as model:
        if sum(item.file_size for item in model.infolist()) > 500_000_000:
            raise ValueError('Model archive is too large.')
        for name in model.namelist():
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('Unsafe model archive path.')
        model.extractall(pathlib.Path(temporary) / 'unpacked')
    roots = list((pathlib.Path(temporary) / 'unpacked').iterdir())
    if len(roots) != 1 or not (roots[0] / 'am').is_dir():
        raise ValueError('Unexpected model layout.')
    shutil.move(str(roots[0]), '/opt/model')
