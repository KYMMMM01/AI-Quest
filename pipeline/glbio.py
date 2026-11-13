# GLB 읽기와 질감 교체 도우미(numpy만 사용)
import struct, json, io
import numpy as np
from PIL import Image

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def load(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    bin_off = 20 + jl + 8
    binary = d[bin_off:bin_off + struct.unpack('<I', d[20 + jl:24 + jl])[0]]
    return j, binary

def view(j, binary, bv):
    v = j['bufferViews'][bv]
    o = v.get('byteOffset', 0)
    return binary[o:o + v['byteLength']]

def accessor(j, binary, i):
    a = j['accessors'][i]
    raw = view(j, binary, a['bufferView'])
    o = a.get('byteOffset', 0)
    arr = np.frombuffer(raw, dtype=CT[a['componentType']], count=a['count'] * NC[a['type']], offset=o)
    return arr.reshape(a['count'], NC[a['type']]) if NC[a['type']] > 1 else arr

def image(j, binary, name_part):
    for im in j['images']:
        if name_part in im['name']:
            return Image.open(io.BytesIO(view(j, binary, im['bufferView']))), im
    raise KeyError(name_part)

def save_with_image(j, binary, image_name_part, new_bytes, out):
    """이미지 한 장의 bufferView만 바꿔 새 GLB를 쓴다. 나머지 데이터는 그대로 둔다."""
    target = next(im['bufferView'] for im in j['images'] if image_name_part in im['name'])
    save_views(j, binary, {target: new_bytes}, out)

def save_views(j, binary, replace, out):
    """bufferView 번호별 새 바이트(replace)로 바꿔 새 GLB를 쓴다."""
    j = json.loads(json.dumps(j))
    chunks, off = [], 0
    for i, v in enumerate(j['bufferViews']):
        data = replace[i] if i in replace else view(j, binary, i)
        pad = (-len(data)) % 4
        v['byteOffset'] = off
        v['byteLength'] = len(data)
        chunks.append(data + b'\0' * pad)
        off += len(data) + pad
    newbin = b''.join(chunks)
    j['buffers'][0]['byteLength'] = len(newbin)
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(newbin)
    with open(out, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(newbin), b'BIN\0')); f.write(newbin)
