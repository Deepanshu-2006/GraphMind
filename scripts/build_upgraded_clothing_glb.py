import struct
import json

def build_upgraded_glb():
    src_glb_path = 'scratch/Asian_M_3_Util.glb'
    dst_glb_path = 'public/models/human_persona_casual.glb'

    with open(src_glb_path, 'rb') as f:
        data = f.read()

    # GLB Header
    magic, version, length = struct.unpack('<4sII', data[:12])
    assert magic == b'glTF'

    # Chunk 0: JSON
    json_len, json_type = struct.unpack('<II', data[12:20])
    assert json_type == 0x4E4F534A
    json_bytes = data[20:20+json_len]
    gltf = json.loads(json_bytes.decode('utf-8'))

    # Chunk 1: BIN
    bin_header_offset = 20 + json_len
    bin_len, bin_type = struct.unpack('<II', data[bin_header_offset:bin_header_offset+8])
    assert bin_type == 0x004E4942
    bin_data = bytearray(data[bin_header_offset+8:bin_header_offset+8+bin_len])

    print("Original GLB bin length:", len(bin_data))
    print("Images in GLTF:", len(gltf.get('images', [])))

    # Read our synthesized WebP images
    with open('public/models/A_M_Premium_Casual_nm.webp', 'rb') as f:
        new_nm_bytes = f.read()

    with open('public/models/A_M_Premium_Casual_color.webp', 'rb') as f:
        new_color_bytes = f.read()

    # Images in Asian_M_3_Util.glb:
    # Image 0: normal map (bufferView 0)
    # Image 1: color map (bufferView 1)
    # Let's inspect bufferViews 0 and 1
    bv0 = gltf['bufferViews'][gltf['images'][0]['bufferView']]
    bv1 = gltf['bufferViews'][gltf['images'][1]['bufferView']]

    print(f"Old Image 0 (NM): offset={bv0.get('byteOffset', 0)}, len={bv0['byteLength']}")
    print(f"Old Image 1 (Color): offset={bv1.get('byteOffset', 0)}, len={bv1['byteLength']}")

    # We will append the new images to the end of the bin buffer (aligned to 4 bytes)
    # to avoid shifting all vertex/accessor offsets in the binary chunk!
    def pad4(b):
        pad = (4 - (len(b) % 4)) % 4
        return b + b'\x00' * pad

    current_bin_len = len(bin_data)
    aligned_offset0 = (current_bin_len + 3) & ~3
    bin_data.extend(b'\x00' * (aligned_offset0 - current_bin_len))

    # Append new normal map
    new_bv0_offset = len(bin_data)
    bin_data.extend(new_nm_bytes)
    aligned_offset1 = (len(bin_data) + 3) & ~3
    bin_data.extend(b'\x00' * (aligned_offset1 - len(bin_data)))

    # Append new color map
    new_bv1_offset = len(bin_data)
    bin_data.extend(new_color_bytes)
    # Final 4-byte alignment
    aligned_final = (len(bin_data) + 3) & ~3
    bin_data.extend(b'\x00' * (aligned_final - len(bin_data)))

    # Update bufferViews in GLTF JSON
    bv0['byteOffset'] = new_bv0_offset
    bv0['byteLength'] = len(new_nm_bytes)

    bv1['byteOffset'] = new_bv1_offset
    bv1['byteLength'] = len(new_color_bytes)

    # Update total buffer length
    gltf['buffers'][0]['byteLength'] = len(bin_data)

    # Re-serialize JSON chunk
    new_json_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    # Pad JSON to 4-byte boundary with spaces (0x20)
    json_pad = (4 - (len(new_json_bytes) % 4)) % 4
    new_json_bytes += b' ' * json_pad
    new_json_len = len(new_json_bytes)

    # Pack final GLB
    new_glb_len = 12 + 8 + new_json_len + 8 + len(bin_data)
    new_header = struct.pack('<4sII', b'glTF', 2, new_glb_len)
    new_json_header = struct.pack('<II', new_json_len, 0x4E4F534A)
    new_bin_header = struct.pack('<II', len(bin_data), 0x004E4942)

    with open(dst_glb_path, 'wb') as f:
        f.write(new_header)
        f.write(new_json_header)
        f.write(new_json_bytes)
        f.write(new_bin_header)
        f.write(bin_data)

    print(f"Successfully generated {dst_glb_path} (size: {new_glb_len} bytes)")

if __name__ == '__main__':
    build_upgraded_glb()
