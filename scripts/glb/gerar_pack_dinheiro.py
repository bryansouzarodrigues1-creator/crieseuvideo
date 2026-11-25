import json
import math
import os
import struct
import numpy as np


def srgb_to_linear(hex_color):
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0

    def conv(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return [round(conv(r), 6), round(conv(g), 6), round(conv(b), 6), 1.0]


def make_material(name, hex_color, roughness=0.65, metallic=0.0, double_sided=False):
    return {
        "name": name,
        "pbrMetallicRoughness": {
            "baseColorFactor": srgb_to_linear(hex_color),
            "metallicFactor": float(metallic),
            "roughnessFactor": float(roughness),
        },
        "doubleSided": bool(double_sided),
    }


class FlatMeshBuilder:
    """Construtor de malhas low-poly flat-shaded com normais externas CCW verificadas."""

    def __init__(self):
        self.positions = []
        self.normals = []
        self.indices = []

    def add_tri(self, p0, p1, p2):
        v0 = np.array(p0, dtype=np.float64)
        v1 = np.array(p1, dtype=np.float64)
        v2 = np.array(p2, dtype=np.float64)
        cross = np.cross(v1 - v0, v2 - v0)
        nlen = np.linalg.norm(cross)
        if nlen < 1e-10:
            return
        n = (cross / nlen).astype(np.float32)
        base = len(self.positions)
        self.positions.extend([v0.astype(np.float32), v1.astype(np.float32), v2.astype(np.float32)])
        self.normals.extend([n, n, n])
        self.indices.extend([base, base + 1, base + 2])

    def add_quad(self, p0, p1, p2, p3):
        self.add_tri(p0, p1, p2)
        self.add_tri(p0, p2, p3)

    def add_box(self, x0, y0, z0, x1, y1, z1):
        """Caixa alinhada aos eixos de (x0,y0,z0) até (x1,y1,z1)."""
        b_fl = (x0, y0, z1)
        b_fr = (x1, y0, z1)
        b_br = (x1, y0, z0)
        b_bl = (x0, y0, z0)
        t_fl = (x0, y1, z1)
        t_fr = (x1, y1, z1)
        t_br = (x1, y1, z0)
        t_bl = (x0, y1, z0)

        self.add_quad(b_fl, b_fr, t_fr, t_fl)  # +Z
        self.add_quad(b_br, b_bl, t_bl, t_br)  # -Z
        self.add_quad(b_fr, b_br, t_br, t_fr)  # +X
        self.add_quad(b_bl, b_fl, t_fl, t_bl)  # -X
        self.add_quad(t_fl, t_fr, t_br, t_bl)  # +Y
        self.add_quad(b_bl, b_br, b_fr, b_fl)  # -Y

    def add_box_centered(self, cx, cy, cz, sx, sy, sz, rot_y=0.0):
        """Caixa centrada em (cx,cy,cz) com rotação opcional em Y."""
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        cy_r, sy_r = math.cos(rot_y), math.sin(rot_y)

        def xf(x, y, z):
            rx = x * cy_r + z * sy_r + cx
            rz = -x * sy_r + z * cy_r + cz
            return (rx, y + cy, rz)

        b_fl = xf(-hx, -hy, +hz)
        b_fr = xf(+hx, -hy, +hz)
        b_br = xf(+hx, -hy, -hz)
        b_bl = xf(-hx, -hy, -hz)
        t_fl = xf(-hx, +hy, +hz)
        t_fr = xf(+hx, +hy, +hz)
        t_br = xf(+hx, +hy, -hz)
        t_bl = xf(-hx, +hy, -hz)

        self.add_quad(b_fl, b_fr, t_fr, t_fl)
        self.add_quad(b_br, b_bl, t_bl, t_br)
        self.add_quad(b_fr, b_br, t_br, t_fr)
        self.add_quad(b_bl, b_fl, t_fl, t_bl)
        self.add_quad(t_fl, t_fr, t_br, t_bl)
        self.add_quad(b_bl, b_br, b_fr, b_fl)

    def add_beveled_box(self, cx, y0, cz, sx, sy, sz, bevel=0.012, rot_y=0.0):
        """Caixa com chanfro superior e inferior, base em y0."""
        rings = [
            (y0, sx - 2 * bevel, sz - 2 * bevel),
            (y0 + bevel, sx, sz),
            (y0 + sy - bevel, sx, sz),
            (y0 + sy, sx - 2 * bevel, sz - 2 * bevel),
        ]
        c_r, s_r = math.cos(rot_y), math.sin(rot_y)

        def ring_pts(y, w, d):
            hx, hz = w * 0.5, d * 0.5
            pts = [(-hx, +hz), (+hx, +hz), (+hx, -hz), (-hx, -hz)]
            return [(x * c_r + z * s_r + cx, y, -x * s_r + z * c_r + cz) for (x, z) in pts]

        rv = [ring_pts(y, w, d) for (y, w, d) in rings]
        for r in range(len(rings) - 1):
            lo, hi = rv[r], rv[r + 1]
            for i in range(4):
                j = (i + 1) % 4
                self.add_quad(lo[i], lo[j], hi[j], hi[i])
        top, bot = rv[-1], rv[0]
        self.add_quad(top[0], top[1], top[2], top[3])
        self.add_quad(bot[3], bot[2], bot[1], bot[0])

    def add_prism_profile_x(self, x0, x1, profile_zy):
        """Extruda um polígono 2D no plano (z, y) ao longo do eixo X [x0, x1] com volume positivo CCW."""
        n = len(profile_zy)
        area2 = sum(
            profile_zy[i][0] * profile_zy[(i + 1) % n][1]
            - profile_zy[(i + 1) % n][0] * profile_zy[i][1]
            for i in range(n)
        )
        # Em (z, y), area2 < 0 corresponde a CCW quando olhado de +X (onde horizontal=-Z, vertical=+Y)
        pts = list(profile_zy) if area2 < 0 else list(reversed(profile_zy))

        left = [(x0, y, z) for (z, y) in pts]
        right = [(x1, y, z) for (z, y) in pts]

        # Laterais com normal externa
        for i in range(n):
            j = (i + 1) % n
            self.add_quad(left[i], left[j], right[j], right[i])

        # Tampas +X e -X
        cx_r = (x1, sum(p[1] for p in pts) / n, sum(p[0] for p in pts) / n)
        cx_l = (x0, cx_r[1], cx_r[2])
        for i in range(n):
            j = (i + 1) % n
            self.add_tri(cx_r, right[i], right[j])
            self.add_tri(cx_l, left[j], left[i])

    def add_cylinder_y(self, cx, y0, y1, cz, r0, r1=None, segments=16, cap_bottom=True, cap_top=True):
        if r1 is None:
            r1 = r0
        angles = [2.0 * math.pi * i / segments for i in range(segments)]
        bot = [(cx + r0 * math.cos(a), y0, cz - r0 * math.sin(a)) for a in angles]
        top = [(cx + r1 * math.cos(a), y1, cz - r1 * math.sin(a)) for a in angles]
        for i in range(segments):
            j = (i + 1) % segments
            self.add_quad(bot[i], bot[j], top[j], top[i])
        if cap_bottom:
            c = (cx, y0, cz)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, bot[j], bot[i])
        if cap_top:
            c = (cx, y1, cz)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, top[i], top[j])

    def add_cylinder_x(self, x0, x1, cy, cz, r0, r1=None, segments=16, cap_neg=True, cap_pos=True):
        """Cilindro ao longo do eixo X (ideal para rodas) com volume positivo CCW."""
        if r1 is None:
            r1 = r0
        angles = [2.0 * math.pi * i / segments for i in range(segments)]
        p_neg = [(x0, cy + r0 * math.cos(a), cz + r0 * math.sin(a)) for a in angles]
        p_pos = [(x1, cy + r1 * math.cos(a), cz + r1 * math.sin(a)) for a in angles]
        for i in range(segments):
            j = (i + 1) % segments
            self.add_quad(p_neg[i], p_neg[j], p_pos[j], p_pos[i])
        if cap_pos:
            c = (x1, cy, cz)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, p_pos[i], p_pos[j])
        if cap_neg:
            c = (x0, cy, cz)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, p_neg[j], p_neg[i])

    def add_cylinder_z(self, cx, cy, z0, z1, r0, r1=None, segments=16, cap_neg=True, cap_pos=True):
        """Cilindro ao longo do eixo Z (ideal para porta circular e volante do cofre)."""
        if r1 is None:
            r1 = r0
        angles = [2.0 * math.pi * i / segments for i in range(segments)]
        p_neg = [(cx + r0 * math.cos(a), cy + r0 * math.sin(a), z0) for a in angles]
        p_pos = [(cx + r1 * math.cos(a), cy + r1 * math.sin(a), z1) for a in angles]
        for i in range(segments):
            j = (i + 1) % segments
            self.add_quad(p_neg[i], p_neg[j], p_pos[j], p_pos[i])
        if cap_pos:
            c = (cx, cy, z1)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, p_pos[i], p_pos[j])
        if cap_neg:
            c = (cx, cy, z0)
            for i in range(segments):
                j = (i + 1) % segments
                self.add_tri(c, p_neg[j], p_neg[i])

    def add_torus_z(self, cx, cy, cz, major_r, minor_r, major_seg=16, minor_seg=8):
        rings = []
        for i in range(major_seg):
            a = 2.0 * math.pi * i / major_seg
            ca, sa = math.cos(a), math.sin(a)
            ring = []
            for j in range(minor_seg):
                b = 2.0 * math.pi * j / minor_seg
                cb, sb = math.cos(b), math.sin(b)
                r = major_r + minor_r * cb
                ring.append((cx + r * ca, cy + r * sa, cz + minor_r * sb))
            rings.append(ring)

        for i in range(major_seg):
            i2 = (i + 1) % major_seg
            for j in range(minor_seg):
                j2 = (j + 1) % minor_seg
                self.add_quad(rings[i][j], rings[i2][j], rings[i2][j2], rings[i][j2])

    def add_torus_y(self, cx, cy, cz, major_r, minor_r, major_seg=16, minor_seg=8, rx_scale=1.0, rz_scale=1.0):
        rings = []
        for i in range(major_seg):
            a = 2.0 * math.pi * i / major_seg
            ca, sa = math.cos(a), math.sin(a)
            ring = []
            for j in range(minor_seg):
                b = 2.0 * math.pi * j / minor_seg
                cb, sb = math.cos(b), math.sin(b)
                r = major_r + minor_r * cb
                ring.append((cx + r * ca * rx_scale, cy + minor_r * sb, cz - r * sa * rz_scale))
            rings.append(ring)

        for i in range(major_seg):
            i2 = (i + 1) % major_seg
            for j in range(minor_seg):
                j2 = (j + 1) % minor_seg
                self.add_quad(rings[i][j], rings[i2][j], rings[i2][j2], rings[i][j2])

    def add_rotated_segment_box(self, p0, p1, width_xy, depth_z):
        v0 = np.array(p0, dtype=np.float64)
        v1 = np.array(p1, dtype=np.float64)
        d = v1 - v0
        length = math.hypot(d[0], d[1])
        if length < 1e-8:
            return
        tx, ty = d[0] / length, d[1] / length
        nx, ny = -ty, tx
        hw = width_xy * 0.5
        hz = depth_z * 0.5
        zm = 0.5 * (v0[2] + v1[2])

        ext = hw * 0.35
        a = np.array([v0[0] - tx * ext, v0[1] - ty * ext])
        b = np.array([v1[0] + tx * ext, v1[1] + ty * ext])

        c0 = (a[0] - nx * hw, a[1] - ny * hw)
        c1 = (b[0] - nx * hw, b[1] - ny * hw)
        c2 = (b[0] + nx * hw, b[1] + ny * hw)
        c3 = (a[0] + nx * hw, a[1] + ny * hw)

        f = [(c[0], c[1], zm + hz) for c in (c0, c1, c2, c3)]
        k = [(c[0], c[1], zm - hz) for c in (c0, c1, c2, c3)]

        self.add_quad(f[0], f[1], f[2], f[3])
        self.add_quad(k[3], k[2], k[1], k[0])
        for i in range(4):
            j = (i + 1) % 4
            self.add_quad(k[i], k[j], f[j], f[i])

    def add_dollar_sign(self, cx, cy, z_back, z_front, height, flip_x=False):
        sx = -1.0 if flip_x else 1.0
        w = height * 0.56
        t = height * 0.145
        hz = z_front - z_back
        zm = 0.5 * (z_front + z_back)

        def pt(nx, ny):
            return (cx + sx * nx * w * 0.5, cy + ny * height * 0.5, zm)

        s_pts = [
            pt(+0.82, +0.58),
            pt(+0.45, +0.76),
            pt(-0.45, +0.76),
            pt(-0.82, +0.48),
            pt(-0.82, +0.20),
            pt(-0.42, +0.04),
            pt(+0.42, -0.04),
            pt(+0.82, -0.22),
            pt(+0.82, -0.50),
            pt(+0.45, -0.76),
            pt(-0.45, -0.76),
            pt(-0.82, -0.56),
        ]
        for i in range(len(s_pts) - 1):
            self.add_rotated_segment_box(s_pts[i], s_pts[i + 1], t, hz)

        self.add_rotated_segment_box(
            pt(0.0, -0.96),
            pt(0.0, +0.96),
            t * 0.78,
            hz * 0.96,
        )

    def build_arrays(self):
        return (
            np.array(self.positions, dtype=np.float32),
            np.array(self.normals, dtype=np.float32),
            np.array(self.indices, dtype=np.uint16),
        )


def export_glb_hierarchy(filepath, scene_name, root_spec, materials):
    bin_blob = bytearray()
    buffer_views = []
    accessors = []
    meshes = []
    nodes = []

    def append_buffer(data_bytes, target):
        while len(bin_blob) % 4 != 0:
            bin_blob.append(0)
        offset = len(bin_blob)
        bin_blob.extend(data_bytes)
        bv_idx = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(data_bytes),
            "target": target,
        })
        return bv_idx

    def register_node(spec):
        idx = len(nodes)
        node_obj = {"name": spec["name"]}
        nodes.append(node_obj)

        if "translation" in spec:
            node_obj["translation"] = [round(float(v), 6) for v in spec["translation"]]
        if "rotation" in spec:
            node_obj["rotation"] = [round(float(v), 6) for v in spec["rotation"]]
        if "scale" in spec:
            node_obj["scale"] = [round(float(v), 6) for v in spec["scale"]]

        if "primitives" in spec and spec["primitives"]:
            mesh_prims = []
            for p in spec["primitives"]:
                pos, nor, inds = p["builder"].build_arrays()
                if len(inds) == 0:
                    continue
                bv_pos = append_buffer(pos.tobytes(), 34962)
                bv_nor = append_buffer(nor.tobytes(), 34962)
                bv_idx = append_buffer(inds.tobytes(), 34963)

                acc_pos = len(accessors)
                accessors.append({
                    "bufferView": bv_pos,
                    "componentType": 5126,
                    "count": len(pos),
                    "type": "VEC3",
                    "min": [round(float(v), 6) for v in pos.min(axis=0)],
                    "max": [round(float(v), 6) for v in pos.max(axis=0)],
                })
                acc_nor = len(accessors)
                accessors.append({
                    "bufferView": bv_nor,
                    "componentType": 5126,
                    "count": len(nor),
                    "type": "VEC3",
                })
                acc_idx = len(accessors)
                accessors.append({
                    "bufferView": bv_idx,
                    "componentType": 5123,
                    "count": len(inds),
                    "type": "SCALAR",
                    "min": [int(inds.min())],
                    "max": [int(inds.max())],
                })
                mesh_prims.append({
                    "attributes": {"POSITION": acc_pos, "NORMAL": acc_nor},
                    "indices": acc_idx,
                    "material": p["material"],
                    "mode": 4,
                })

            if mesh_prims:
                mesh_idx = len(meshes)
                meshes.append({"name": spec["name"], "primitives": mesh_prims})
                node_obj["mesh"] = mesh_idx

        if "children" in spec and spec["children"]:
            node_obj["children"] = [register_node(ch) for ch in spec["children"]]

        return idx

    root_idx = register_node(root_spec)

    while len(bin_blob) % 4 != 0:
        bin_blob.append(0)

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "SceneProgram Pack Dinheiro GLB Generator v1.0",
        },
        "scene": 0,
        "scenes": [{"name": scene_name, "nodes": [root_idx]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    with open(filepath, "wb") as f:
        f.write(b"glTF")
        f.write(struct.pack("<II", 2, total_length))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_blob), 0x004E4942))
        f.write(bin_blob)


# ==============================================================================
# MODELO 1: pilha_notas_100.glb (~1.2 x 1.2 x 1.0 m)
# ==============================================================================
def build_pilha_notas_100(filepath="pilha_notas_100.glb"):
    materials = [
        make_material("mat_pallet_madeira", "#A87B4E", roughness=0.82, metallic=0.0),
        make_material("mat_nota_verde", "#5C8A5A", roughness=0.72, metallic=0.0),
        make_material("mat_faixa_papel", "#D9C9A0", roughness=0.75, metallic=0.0),
    ]

    pallet = FlatMeshBuilder()
    for lx in (-0.51, 0.0, +0.51):
        pallet.add_box(lx - 0.075, 0.000, -0.60, lx + 0.075, 0.025, +0.60)
    for lx in (-0.51, 0.0, +0.51):
        for lz in (-0.51, 0.0, +0.51):
            pallet.add_box(lx - 0.072, 0.025, lz - 0.072, lx + 0.072, 0.112, lz + 0.072)
    for tz in np.linspace(-0.525, +0.525, 6):
        pallet.add_box(-0.60, 0.112, tz - 0.072, +0.60, 0.140, tz + 0.072)

    children = [{"name": "pallet", "primitives": [{"builder": pallet, "material": 0}]}]
    faixa_builder = FlatMeshBuilder()

    layer_h = 0.215  # 0.140 + 4 * 0.215 = 1.000 m
    fardo_idx = 1
    jitter_deg = [
        0.8, -0.6, 0.4, -0.9, 0.5, -0.4,
        -0.7, 0.5, -0.5, 0.8, -0.6, 0.7,
        0.6, -0.8, 0.3, -0.5, 0.9, -0.7,
        -1.2, 1.4, -0.9, 1.1, -1.5, 1.8,
    ]

    for layer in range(4):
        y0 = 0.140 + layer * layer_h
        alt = (layer % 2 == 1)
        if not alt:
            xs, zs = (-0.275, +0.275), (-0.36, 0.0, +0.36)
            sx, sz, band_along_x = 0.51, 0.31, True
        else:
            xs, zs = (-0.36, 0.0, +0.36), (-0.275, +0.275)
            sx, sz, band_along_x = 0.31, 0.51, False

        for cx in xs:
            for cz in zs:
                rot = math.radians(jitter_deg[fardo_idx - 1])
                bh = layer_h - 0.004
                fb = FlatMeshBuilder()
                fb.add_beveled_box(cx, y0, cz, sx, bh, sz, bevel=0.010, rot_y=rot)
                children.append({
                    "name": f"fardo_{fardo_idx}",
                    "primitives": [{"builder": fb, "material": 1}],
                })

                band_w = 0.095
                if band_along_x:
                    faixa_builder.add_box_centered(cx, y0 + bh * 0.5, cz, band_w, bh + 0.008, sz + 0.008, rot_y=rot)
                else:
                    faixa_builder.add_box_centered(cx, y0 + bh * 0.5, cz, sx + 0.008, bh + 0.008, band_w, rot_y=rot)
                fardo_idx += 1

    children.append({"name": "faixa", "primitives": [{"builder": faixa_builder, "material": 2}]})
    export_glb_hierarchy(filepath, "pilha_notas_100", {"name": "pilha_notas_100", "children": children}, materials)


# ==============================================================================
# MODELO 2: caminhao_blindado.glb (~6.0 m comprimento, +Z frente)
# ==============================================================================
def build_caminhao_blindado(filepath="caminhao_blindado.glb"):
    materials = [
        make_material("mat_blindagem_cinza", "#6E7781", roughness=0.52, metallic=0.25),
        make_material("mat_vidro", "#3A4A5A", roughness=0.18, metallic=0.25),
        make_material("mat_rodas", "#222222", roughness=0.88, metallic=0.0),
        make_material("mat_detalhe_escuro", "#3D444C", roughness=0.72, metallic=0.35),
        make_material("mat_aro_metal", "#9CA6B0", roughness=0.38, metallic=0.75),
        make_material("mat_farol", "#EFE5B0", roughness=0.25, metallic=0.1),
        make_material("mat_lanterna", "#B83B3B", roughness=0.35, metallic=0.1),
    ]

    # Rodas: raio = 0.42 m (y = 0.00..0.84 m), largura = 0.26 m, x = +-0.92 (ocupa |x| = 0.79..1.05)
    # Vãos reais das rodas (folga >= 0.05 m em X e Y para zero clipping!)

    # 1. CABINE (+Z: z = +0.86 até +2.90)
    cab_body = FlatMeshBuilder()
    # Corpo principal superior da cabine acima das caixas de roda (y >= 0.90)
    cab_upper_profile = [
        (0.86, 0.90),
        (2.86, 0.90),
        (2.88, 1.24),
        (2.78, 1.48),
        (2.12, 1.56),
        (1.80, 2.38),
        (0.86, 2.42),
    ]
    cab_body.add_prism_profile_x(-1.02, +1.02, cab_upper_profile)
    # Bloco inferior do motor entre as rodas dianteiras (|x| <= 0.74, sem tocar pneus!)
    cab_body.add_box(-0.74, 0.50, 0.86, +0.74, 0.90, 2.86)
    # Nariz frontal à frente da roda dianteira (z = 2.38..2.88)
    cab_body.add_box(-1.02, 0.56, 2.38, +1.02, 0.90, 2.88)
    # Soleira da porta atrás da roda dianteira (z = 0.86..1.34)
    cab_body.add_box(-1.02, 0.54, 0.86, +1.02, 0.90, 1.34)
    # Viseira blindada acima do para-brisa
    cab_body.add_box(-1.04, 2.30, 1.78, +1.04, 2.40, 2.02)

    cab_trim = FlatMeshBuilder()
    # Para-choque dianteiro reforçado (até z = +3.00)
    cab_trim.add_box(-1.08, 0.38, 2.86, +1.08, 0.64, 3.00)
    # Grade frontal blindada
    cab_trim.add_box(-0.56, 0.78, 2.88, +0.56, 1.32, 2.94)
    # Estribos laterais sob a porta da cabine (atrás da roda dianteira)
    cab_trim.add_box(-1.10, 0.40, 0.90, -1.00, 0.50, 1.34)
    cab_trim.add_box(+1.00, 0.40, 0.90, +1.10, 0.50, 1.34)
    # Para-lama dianteiro sobre a roda dianteira (y = 0.90..0.98)
    cab_trim.add_box(-1.10, 0.90, 1.34, -0.96, 0.98, 2.38)
    cab_trim.add_box(+0.96, 0.90, 1.34, +1.10, 0.98, 2.38)
    # Retrovisores
    for side in (-1.0, +1.0):
        xa, xb = sorted((side * 1.02, side * 1.18))
        cab_trim.add_box(xa, 1.62, 1.76, xb, 1.67, 1.82)
        cab_trim.add_box(xa, 1.98, 1.76, xb, 2.03, 1.82)
        mx = side * 1.16
        cab_trim.add_box(mx - 0.04, 1.60, 1.73, mx + 0.04, 2.06, 1.84)

    cab_lights = FlatMeshBuilder()
    cab_lights.add_box(-0.92, 0.88, 2.88, -0.66, 1.10, 2.94)
    cab_lights.add_box(+0.66, 0.88, 2.88, +0.92, 1.10, 2.94)

    # 2. CARROCERIA BLINDADA (z = -2.90 até +0.86)
    cargo_body = FlatMeshBuilder()
    # Baú superior acima das rodas traseiras (y = 0.90..2.62)
    cargo_upper_profile = [
        (-2.90, 0.90),
        (+0.86, 0.90),
        (+0.86, 2.50),
        (+0.72, 2.62),
        (-2.78, 2.62),
        (-2.90, 2.50),
    ]
    cargo_body.add_prism_profile_x(-1.08, +1.08, cargo_upper_profile)
    # Saia lateral entre eixo dianteiro e traseiro (z = -0.52 até +0.86)
    cargo_body.add_box(-1.06, 0.56, -0.52, +1.06, 0.90, +0.86)
    # Saia traseira atrás da última roda (z = -2.90 até -2.56)
    cargo_body.add_box(-1.06, 0.58, -2.90, +1.06, 0.90, -2.56)
    # Frisos laterais de reforço
    for side in (-1.0, +1.0):
        x0, x1 = (-1.11, -1.08) if side < 0 else (1.08, 1.11)
        cargo_body.add_box(x0, 1.24, -2.84, x1, 1.34, 0.80)
        cargo_body.add_box(x0, 2.34, -2.84, x1, 2.44, 0.80)

    cargo_trim = FlatMeshBuilder()
    # Longarina central do chassi (|x| <= 0.68, passando livre entre as rodas!)
    cargo_trim.add_box(-0.68, 0.42, -2.86, +0.68, 0.90, +2.70)
    # Para-choque traseiro / degrau (z = -3.00 até -2.84)
    cargo_trim.add_box(-1.08, 0.42, -3.00, +1.08, 0.64, -2.84)
    # Moldura da porta traseira
    cargo_trim.add_box(-0.76, 0.72, -2.93, -0.68, 2.28, -2.88)
    cargo_trim.add_box(+0.68, 0.72, -2.93, +0.76, 2.28, -2.88)
    cargo_trim.add_box(-0.76, 2.22, -2.93, +0.76, 2.30, -2.88)
    # Para-lamas traseiros sobre o par de eixos traseiros (z = -2.56 até -0.52)
    cargo_trim.add_box(-1.12, 0.90, -2.56, -0.98, 0.98, -0.52)
    cargo_trim.add_box(+0.98, 0.90, -2.56, +1.12, 0.98, -0.52)

    cargo_taillights = FlatMeshBuilder()
    cargo_taillights.add_box(-1.00, 0.78, -2.94, -0.80, 0.98, -2.89)
    cargo_taillights.add_box(+0.80, 0.78, -2.94, +1.00, 0.98, -2.89)

    # 3. JANELA
    janela = FlatMeshBuilder()
    ws_profile = [
        (2.13, 1.62),
        (2.19, 1.62),
        (1.90, 2.26),
        (1.84, 2.26),
    ]
    janela.add_prism_profile_x(-0.88, +0.88, ws_profile)
    for side in (-1.0, +1.0):
        x0, x1 = (-1.05, -1.00) if side < 0 else (+1.00, +1.05)
        janela.add_box(x0, 1.62, 1.04, x1, 2.22, 1.74)
        bx0, bx1 = (-1.11, -1.06) if side < 0 else (+1.06, +1.11)
        janela.add_box(bx0, 1.88, -0.20, bx1, 2.12, +0.44)
        janela.add_box(bx0, 1.88, -1.96, bx1, 2.12, -1.32)

    # 4. PORTA TRASEIRA (pivot na dobradiça esquerda: [-0.68, 1.48, -2.93])
    # Rotacionar em +Y (0 a +120 graus) abre a porta para fora (-Z)!
    door_pivot = [-0.68, 1.48, -2.93]
    door_panel = FlatMeshBuilder()
    door_panel.add_box(0.00, -0.73, -0.055, +1.36, +0.73, +0.015)
    door_panel.add_box(0.08, -0.08, -0.072, +1.28, +0.08, -0.050)

    door_glass = FlatMeshBuilder()
    door_glass.add_box(0.38, +0.22, -0.068, +0.98, +0.52, -0.045)

    door_hardware = FlatMeshBuilder()
    door_hardware.add_box(1.16, -0.18, -0.095, 1.26, +0.16, -0.050)
    door_hardware.add_cylinder_y(0.0, +0.34, +0.56, 0.0, 0.032, segments=8)
    door_hardware.add_cylinder_y(0.0, -0.56, -0.34, 0.0, 0.032, segments=8)

    # 5. RODAS (roda_1..roda_6) com pivot no centro do eixo (y = 0.42 -> toca chão em y = 0.000)
    wheel_specs = [
        ("roda_1", -0.92, 0.42, +1.86),  # dianteira esquerda
        ("roda_2", +0.92, 0.42, +1.86),  # dianteira direita
        ("roda_3", -0.92, 0.42, -1.04),  # traseira 1 esquerda
        ("roda_4", +0.92, 0.42, -1.04),  # traseira 1 direita
        ("roda_5", -0.92, 0.42, -2.04),  # traseira 2 esquerda
        ("roda_6", +0.92, 0.42, -2.04),  # traseira 2 direita
    ]
    wheel_nodes = []
    for wname, wx, wy, wz in wheel_specs:
        tire = FlatMeshBuilder()
        rim = FlatMeshBuilder()
        tire.add_cylinder_x(-0.13, +0.13, 0.0, 0.0, 0.42, segments=14)
        rim.add_cylinder_x(-0.145, +0.145, 0.0, 0.0, 0.23, segments=10)
        rim.add_box(-0.155, -0.17, -0.038, +0.155, +0.17, +0.038)
        wheel_nodes.append({
            "name": wname,
            "translation": [wx, wy, wz],
            "primitives": [
                {"builder": tire, "material": 2},
                {"builder": rim, "material": 4},
            ],
        })

    children = [
        {
            "name": "cabine",
            "primitives": [
                {"builder": cab_body, "material": 0},
                {"builder": cab_trim, "material": 3},
                {"builder": cab_lights, "material": 5},
            ],
        },
        {
            "name": "carroceria",
            "primitives": [
                {"builder": cargo_body, "material": 0},
                {"builder": cargo_trim, "material": 3},
                {"builder": cargo_taillights, "material": 6},
            ],
        },
        {"name": "janela", "primitives": [{"builder": janela, "material": 1}]},
        {
            "name": "porta_traseira",
            "translation": door_pivot,
            "primitives": [
                {"builder": door_panel, "material": 0},
                {"builder": door_glass, "material": 1},
                {"builder": door_hardware, "material": 4},
            ],
        },
    ] + wheel_nodes

    export_glb_hierarchy(filepath, "caminhao_blindado", {"name": "caminhao_blindado", "children": children}, materials)


# ==============================================================================
# MODELO 3: cofre_gigante.glb (~2.0 m altura, câmara interna oca real)
# ==============================================================================
def build_cofre_gigante(filepath="cofre_gigante.glb"):
    materials = [
        make_material("mat_aco_cofre", "#8A949E", roughness=0.42, metallic=0.68),
        make_material("mat_volante_ouro", "#C9A227", roughness=0.30, metallic=0.88),
        make_material("mat_aco_escuro", "#4B525A", roughness=0.58, metallic=0.55),
        make_material("mat_interior_cofre", "#2D333B", roughness=0.75, metallic=0.30),
    ]

    # Frente quadrada perfeita (1.90 x 1.90 m, y = 0.10..2.00, x = -0.95..+0.95)
    # centrada em cy_door = 1.05 para os ângulos 45/135/225/315 baterem exatamente nos 4 cantos!
    corpo_ext = FlatMeshBuilder()
    corpo_dark = FlatMeshBuilder()
    corpo_int = FlatMeshBuilder()

    # 4 pés blindados (y = 0.00..0.10)
    for fx in (-0.78, +0.78):
        for fz in (-0.58, +0.58):
            corpo_dark.add_box(fx - 0.13, 0.000, fz - 0.13, fx + 0.13, 0.100, fz + 0.13)

    # Câmara oca traseira (z = -0.75..+0.58)
    corpo_ext.add_box(-0.95, 0.10, -0.75, +0.95, 0.26, +0.58)   # base
    corpo_ext.add_box(-0.95, 1.84, -0.75, +0.95, 2.00, +0.58)   # teto
    corpo_ext.add_box(-0.95, 0.26, -0.75, -0.79, 1.84, +0.58)   # parede esquerda
    corpo_ext.add_box(+0.79, 0.26, -0.75, +0.95, 1.84, +0.58)   # parede direita
    corpo_ext.add_box(-0.79, 0.26, -0.75, +0.79, 1.84, -0.59)   # parede fundo

    # Interior escuro da câmara + prateleira traseira
    corpo_int.add_box(-0.78, 0.26, -0.58, +0.78, 0.28, +0.57)
    corpo_int.add_box(-0.77, 1.15, -0.58, +0.77, 1.19, -0.15)

    # Fachada frontal com vão circular real (z = +0.58..+0.75)
    cy_door = 1.05
    r_hole = 0.64
    segs = 16
    z_in, z_out = 0.58, 0.75
    hx_frame = 0.95
    y_bot, y_top = 0.10, 2.00

    inner_front, inner_back, outer_front, outer_back = [], [], [], []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        ix, iy = r_hole * ca, cy_door + r_hole * sa
        t_hit = min(
            hx_frame / abs(ca) if abs(ca) > 1e-6 else 1e9,
            hx_frame / abs(sa) if abs(sa) > 1e-6 else 1e9,
        )
        ox, oy = t_hit * ca, cy_door + t_hit * sa
        inner_front.append((ix, iy, z_out))
        inner_back.append((ix, iy, z_in))
        outer_front.append((ox, oy, z_out))
        outer_back.append((ox, oy, z_in))

    for i in range(segs):
        j = (i + 1) % segs
        corpo_ext.add_quad(inner_front[i], outer_front[i], outer_front[j], inner_front[j])
        corpo_ext.add_quad(inner_back[j], outer_back[j], outer_back[i], inner_back[i])
        corpo_ext.add_quad(outer_front[i], outer_back[i], outer_back[j], outer_front[j])
        corpo_dark.add_quad(inner_back[i], inner_front[i], inner_front[j], inner_back[j])

    # Friso blindado superior (y = 1.94..2.00)
    corpo_dark.add_box(-0.97, 1.94, -0.77, +0.97, 2.00, +0.77)

    # Dobradiças fixas no lado direito (+X)
    hinge_x = 0.76
    hinge_z = 0.80
    dob1 = FlatMeshBuilder()
    dob1.add_box(0.66, 1.31, 0.73, 0.83, 1.47, 0.85)
    dob1.add_cylinder_y(hinge_x, 1.27, 1.51, hinge_z, 0.042, segments=10)

    dob2 = FlatMeshBuilder()
    dob2.add_box(0.66, 0.63, 0.73, 0.83, 0.79, 0.85)
    dob2.add_cylinder_y(hinge_x, 0.59, 0.83, hinge_z, 0.042, segments=10)

    # PORTA CIRCULAR (pivot na dobradiça [0.76, 1.05, 0.80]; rotação +Y abre para fora em +Z)
    door_pivot = [hinge_x, cy_door, hinge_z]
    dcx = -hinge_x
    porta_main = FlatMeshBuilder()
    porta_bolts = FlatMeshBuilder()

    porta_bolts.add_cylinder_z(dcx, 0.0, -0.14, -0.04, 0.61, segments=16)
    porta_main.add_cylinder_z(dcx, 0.0, -0.04, +0.08, 0.70, segments=16)
    porta_main.add_cylinder_z(dcx, 0.0, +0.08, +0.12, 0.70, 0.65, segments=16)

    # Braços de articulação até o eixo da dobradiça (x_local = 0)
    porta_bolts.add_box(dcx + 0.46, +0.29, -0.03, +0.03, +0.39, +0.04)
    porta_bolts.add_box(dcx + 0.46, -0.39, -0.03, +0.03, -0.29, +0.04)
    porta_bolts.add_cylinder_y(0.0, -0.39, +0.39, 0.0, 0.030, segments=8)

    # 6 pinos de travamento na lateral da porta
    for k in range(6):
        ang = math.radians(k * 60 + 30)
        ca, sa = math.cos(ang), math.sin(ang)
        porta_bolts.add_rotated_segment_box(
            (dcx + 0.54 * ca, 0.54 * sa, -0.09),
            (dcx + 0.67 * ca, 0.67 * sa, -0.09),
            0.055,
            0.055,
        )

    # VOLANTE DOURADO (nó filho de `porta`, pivot no centro do disco para girar em Z)
    volante = FlatMeshBuilder()
    volante.add_cylinder_z(0.0, 0.0, -0.02, +0.15, 0.085, 0.065, segments=12)
    volante.add_cylinder_z(0.0, 0.0, +0.14, +0.18, 0.068, 0.050, segments=12)
    volante.add_torus_z(0.0, 0.0, +0.12, major_r=0.33, minor_r=0.032, major_seg=16, minor_seg=8)
    for k in range(4):
        ang = k * (math.pi * 0.5) + math.pi * 0.25
        volante.add_rotated_segment_box(
            (0.0, 0.0, +0.12),
            (0.32 * math.cos(ang), 0.32 * math.sin(ang), +0.12),
            0.044,
            0.044,
        )

    root = {
        "name": "cofre_gigante",
        "children": [
            {
                "name": "corpo",
                "primitives": [
                    {"builder": corpo_ext, "material": 0},
                    {"builder": corpo_dark, "material": 2},
                    {"builder": corpo_int, "material": 3},
                ],
            },
            {"name": "dobradica_1", "primitives": [{"builder": dob1, "material": 2}]},
            {"name": "dobradica_2", "primitives": [{"builder": dob2, "material": 2}]},
            {
                "name": "porta",
                "translation": door_pivot,
                "primitives": [
                    {"builder": porta_main, "material": 0},
                    {"builder": porta_bolts, "material": 2},
                ],
                "children": [
                    {
                        "name": "volante",
                        "translation": [dcx, 0.0, 0.12],
                        "primitives": [{"builder": volante, "material": 1}],
                    }
                ],
            },
        ],
    }
    export_glb_hierarchy(filepath, "cofre_gigante", root, materials)


# ==============================================================================
# MODELO 4: saco_dinheiro.glb (~0.50 m altura)
# ==============================================================================
def build_saco_dinheiro(filepath="saco_dinheiro.glb"):
    materials = [
        make_material("mat_lona", "#B89B6A", roughness=0.88, metallic=0.0),
        make_material("mat_simbolo_cifrao", "#2F6B3A", roughness=0.55, metallic=0.0),
        make_material("mat_corda", "#7A5B36", roughness=0.90, metallic=0.0),
    ]

    saco = FlatMeshBuilder()
    segs = 16
    profile = [
        (0.000, 0.120, 0.110, 0.000),
        (0.030, 0.168, 0.152, 0.000),
        (0.100, 0.196, 0.178, 0.004),
        (0.185, 0.194, 0.176, 0.005),
        (0.270, 0.162, 0.148, 0.006),
        (0.335, 0.102, 0.094, 0.005),
        (0.368, 0.068, 0.064, 0.003),
        (0.415, 0.105, 0.096, 0.014),
        (0.475, 0.132, 0.118, 0.022),
        (0.500, 0.116, 0.104, 0.018),
        (0.460, 0.042, 0.038, 0.004),
    ]

    rings = []
    for y, rx, rz, wave in profile:
        ring = []
        for i in range(segs):
            a = 2.0 * math.pi * i / segs
            w = 1.0 + (wave / max(rx, 0.01)) * math.sin(5.0 * a + 0.4)
            ring.append((rx * w * math.cos(a), y, -rz * w * math.sin(a)))
        rings.append(ring)

    for k in range(len(rings) - 1):
        r0, r1 = rings[k], rings[k + 1]
        for i in range(segs):
            j = (i + 1) % segs
            saco.add_quad(r0[i], r0[j], r1[j], r1[i])

    c_bot = (0.0, profile[0][0], 0.0)
    c_top = (0.0, profile[-1][0], 0.0)
    for i in range(segs):
        j = (i + 1) % segs
        saco.add_tri(c_bot, rings[0][j], rings[0][i])
        saco.add_tri(c_top, rings[-1][i], rings[-1][j])

    corda = FlatMeshBuilder()
    corda.add_torus_y(0.0, 0.368, 0.0, major_r=0.074, minor_r=0.016, major_seg=14, minor_seg=6, rx_scale=1.03, rz_scale=0.97)
    corda.add_box_centered(0.055, 0.365, 0.060, 0.034, 0.034, 0.034, rot_y=0.4)
    corda.add_box_centered(0.075, 0.330, 0.068, 0.018, 0.068, 0.018, rot_y=0.3)

    cifrao = FlatMeshBuilder()
    cifrao.add_dollar_sign(cx=0.0, cy=0.175, z_back=0.150, z_front=0.195, height=0.165, flip_x=False)

    root = {
        "name": "saco_dinheiro",
        "children": [
            {"name": "saco_corpo", "primitives": [{"builder": saco, "material": 0}]},
            {"name": "corda", "primitives": [{"builder": corda, "material": 2}]},
            {"name": "simbolo_cifrao", "primitives": [{"builder": cifrao, "material": 1}]},
        ],
    }
    export_glb_hierarchy(filepath, "saco_dinheiro", root, materials)


# ==============================================================================
# MODELO 5: moeda_grande.glb (1.00 m diâmetro x 0.12 m espessura, de pé)
# ==============================================================================
def build_moeda_grande(filepath="moeda_grande.glb"):
    materials = [
        make_material("mat_ouro", "#D4AF37", roughness=0.30, metallic=0.90),
    ]

    moeda = FlatMeshBuilder()
    cy = 0.50
    teeth = 24
    segs = teeth * 2
    z_out = 0.060
    z_in = 0.038
    r_rim_inner = 0.428
    r_bevel = 0.468

    angles = [2.0 * math.pi * i / segs for i in range(segs)]
    outer_radii = [0.500 if (i % 2 == 0) else 0.484 for i in range(segs)]

    edge_f = [(outer_radii[i] * math.cos(a), cy + outer_radii[i] * math.sin(a), +z_out * 0.88) for i, a in enumerate(angles)]
    edge_b = [(outer_radii[i] * math.cos(a), cy + outer_radii[i] * math.sin(a), -z_out * 0.88) for i, a in enumerate(angles)]

    rim_out_f = [(r_bevel * math.cos(a), cy + r_bevel * math.sin(a), +z_out) for a in angles]
    rim_out_b = [(r_bevel * math.cos(a), cy + r_bevel * math.sin(a), -z_out) for a in angles]

    rim_in_f = [(r_rim_inner * math.cos(a), cy + r_rim_inner * math.sin(a), +z_out) for a in angles]
    rim_in_b = [(r_rim_inner * math.cos(a), cy + r_rim_inner * math.sin(a), -z_out) for a in angles]

    field_f = [(r_rim_inner * math.cos(a), cy + r_rim_inner * math.sin(a), +z_in) for a in angles]
    field_b = [(r_rim_inner * math.cos(a), cy + r_rim_inner * math.sin(a), -z_in) for a in angles]

    cf = (0.0, cy, +z_in)
    cb = (0.0, cy, -z_in)

    for i in range(segs):
        j = (i + 1) % segs
        moeda.add_quad(edge_b[i], edge_b[j], edge_f[j], edge_f[i])
        moeda.add_quad(edge_f[i], edge_f[j], rim_out_f[j], rim_out_f[i])
        moeda.add_quad(rim_out_b[i], rim_out_b[j], edge_b[j], edge_b[i])
        moeda.add_quad(rim_out_f[i], rim_out_f[j], rim_in_f[j], rim_in_f[i])
        moeda.add_quad(rim_in_b[i], rim_in_b[j], rim_out_b[j], rim_out_b[i])
        moeda.add_quad(rim_in_f[i], rim_in_f[j], field_f[j], field_f[i])
        moeda.add_quad(field_b[i], field_b[j], rim_in_b[j], rim_in_b[i])
        moeda.add_tri(cf, field_f[i], field_f[j])
        moeda.add_tri(cb, field_b[j], field_b[i])

    # Símbolo $ em relevo na frente (+Z) e no verso (-Z), totalizando exatamente 0.120 m de espessura
    cifrao_f = FlatMeshBuilder()
    cifrao_f.add_dollar_sign(cx=0.0, cy=cy, z_back=z_in - 0.004, z_front=z_out, height=0.56, flip_x=False)

    cifrao_b = FlatMeshBuilder()
    cifrao_b.add_dollar_sign(cx=0.0, cy=cy, z_back=-z_out, z_front=-(z_in - 0.004), height=0.56, flip_x=True)

    root = {
        "name": "moeda_grande",
        "children": [
            {"name": "moeda_corpo", "primitives": [{"builder": moeda, "material": 0}]},
            {"name": "simbolo_cifrao_frente", "primitives": [{"builder": cifrao_f, "material": 0}]},
            {"name": "simbolo_cifrao_tras", "primitives": [{"builder": cifrao_b, "material": 0}]},
        ],
    }
    export_glb_hierarchy(filepath, "moeda_grande", root, materials)


def build_all(output_dir="."):
    os.makedirs(output_dir, exist_ok=True)
    build_pilha_notas_100(os.path.join(output_dir, "pilha_notas_100.glb"))
    build_caminhao_blindado(os.path.join(output_dir, "caminhao_blindado.glb"))
    build_cofre_gigante(os.path.join(output_dir, "cofre_gigante.glb"))
    build_saco_dinheiro(os.path.join(output_dir, "saco_dinheiro.glb"))
    build_moeda_grande(os.path.join(output_dir, "moeda_grande.glb"))


if __name__ == "__main__":
    build_all(".")
    print("Todos os 5 modelos .glb foram exportados com sucesso!")
