import numpy as np
from PIL import Image, ImageFilter

def build_clothing_textures():
    print("Loading original source textures from VALID asset...")
    color_img = Image.open('scratch/raw_extracted_img_1.webp').convert('RGB')
    nm_img = Image.open('scratch/raw_extracted_img_0.webp').convert('RGB')

    w, h = color_img.size
    color = np.array(color_img, dtype=np.float32)
    nm = np.array(nm_img, dtype=np.float32)

    Y, X = np.mgrid[:h, :w]
    r_orig, g_orig, b_orig = color[:, :, 0], color[:, :, 1], color[:, :, 2]

    # =========================================================================
    # 1. INNER LAYER: MATTE BLACK CREW-NECK T-SHIRT MASKS
    # =========================================================================
    # Part A: Crew-neck collar rib band
    is_collar_band = (
        (Y >= 1045) & (Y <= 1115) & (X >= 520) & (X <= 860) &
        (r_orig > 140) & (g_orig > 140) & (b_orig > 140)
    )
    # Part B: Chest V triangle opening between overshirt lapels
    is_chest_v = (
        (Y >= 1435) & (Y <= 1565) & (X >= 1810) & (X <= 1950) &
        (r_orig > 130) & (g_orig > 130) & (b_orig > 130)
    )
    is_tshirt_raw = is_collar_band | is_chest_v

    # Dilate 2px to ensure seamless seam closure under lapels
    tshirt_pil = Image.fromarray(is_tshirt_raw.astype(np.uint8) * 255)
    tshirt_mask = np.array(tshirt_pil.filter(ImageFilter.MaxFilter(5))) > 128

    # Guards: Protect neck skin (Y < 1046) and mouth cavity (X > 1945, Y >= 1400)
    tshirt_mask = tshirt_mask & ~((Y < 1046) & (X >= 500) & (X <= 880))
    tshirt_mask = tshirt_mask & ~((X > 1945) & (Y >= 1400))

    print(f"Inner T-shirt mask pixels: {np.sum(tshirt_mask)}")

    # =========================================================================
    # 2. OUTER LAYER: DARK CHARCOAL OVERSHIRT MASK
    # =========================================================================
    # Neck and Face skin zones to strictly preserve
    is_neck_skin = (Y < 1046) & (X >= 540) & (X <= 840)
    is_face_skin = (Y < 880) & (X < 1050)
    is_protected_skin = is_neck_skin | is_face_skin

    # Leather boots and mouth / teeth cavities
    is_boots = ((X < 450) & (Y > 1100) & (Y < 1550)) | ((X > 1700) & (Y < 750))
    is_teeth = ((Y > 1850) & (X > 500) & (X < 1100))
    is_mouth = (Y >= 1400) & (Y <= 1600) & (X >= 1945)

    # Collar lapel inner wings / facing (Y in [1045, 1095], X flanking collar)
    is_lapel_facing = (Y >= 1045) & (Y <= 1095) & (((X >= 505) & (X <= 542)) | ((X >= 795) & (X <= 835)))

    # In Asian_M_3_Util, the overshirt is olive green throughout torso, sleeves, and collar lapels
    is_overshirt = (
        (((g_orig > r_orig - 25) & (g_orig > b_orig + 5)) | is_lapel_facing) &
        ~is_protected_skin & ~is_boots & ~is_teeth & ~is_mouth & ~tshirt_mask
    )

    print(f"Outer overshirt mask pixels: {np.sum(is_overshirt)}")

    # =========================================================================
    # 3. COLOR SYNTHESIS: PHOTOREALISTIC FABRICS
    # =========================================================================
    # Inner T-Shirt: Matte black cotton jersey (#121316 -> RGB: 18, 19, 22)
    # 1x1 fine horizontal rib-knit pattern
    rib_knit = 0.94 + 0.06 * np.sin(Y.astype(np.float32) * 2.2)
    # Subtle cotton micro-variation
    np.random.seed(42)
    cotton_noise = 1.0 + 0.03 * (np.random.rand(h, w) - 0.5)

    tshirt_color_r = 18.0 * rib_knit * cotton_noise
    tshirt_color_g = 19.0 * rib_knit * cotton_noise
    tshirt_color_b = 22.0 * rib_knit * cotton_noise

    # Outer Overshirt: Dark charcoal cotton-twill (#26292D -> RGB: 38, 41, 45)
    # Preserve authentic fold shading from original model's baked lighting
    orig_lum = 0.299 * r_orig + 0.587 * g_orig + 0.114 * b_orig
    mean_lum = np.mean(orig_lum[is_overshirt])
    relative_folds = np.clip(orig_lum / max(1.0, mean_lum), 0.45, 1.65)
    relative_folds = np.power(relative_folds, 1.15) # rich shadow depth

    # 2/1 Diagonal Twill Weave Pattern (woven appearance)
    twill_diag = (np.sin((X + Y).astype(np.float32) * 1.25) + np.cos((X - Y).astype(np.float32) * 1.25)) * 0.5
    twill_grain = 1.0 + 0.04 * twill_diag

    overshirt_color_r = np.clip(38.0 * relative_folds * twill_grain, 14.0, 95.0)
    overshirt_color_g = np.clip(41.0 * relative_folds * twill_grain, 16.0, 98.0)
    overshirt_color_b = np.clip(45.0 * relative_folds * twill_grain, 18.0, 105.0)

    # Front Placket, Stitching & Buttons along X ~ 1420, Y in [1150, 1800]
    placket_x = 1420
    stitch_dash = (Y % 6 < 3)
    stitch_line = (
        ((np.abs(X - (placket_x - 14)) <= 1) | (np.abs(X - (placket_x + 14)) <= 1)) &
        (Y >= 1150) & (Y <= 1800) & stitch_dash & is_overshirt
    )
    overshirt_color_r[stitch_line] = 58.0
    overshirt_color_g[stitch_line] = 62.0
    overshirt_color_b[stitch_line] = 68.0

    # 4 Matte-Charcoal Buttons
    button_ys = [1240, 1380, 1520, 1660]
    button_radius = 16
    for by in button_ys:
        dist_sq = (X - placket_x)**2 + (Y - by)**2
        button_disc = (dist_sq <= button_radius**2) & is_overshirt
        button_rim = (dist_sq <= button_radius**2) & (dist_sq >= (button_radius - 3)**2) & is_overshirt
        button_dish = (dist_sq < (button_radius - 3)**2) & is_overshirt

        # 4 Thread holes
        hole_radius = 2.5
        holes = np.zeros_like(dist_sq, dtype=bool)
        for hx, hy in [(-4, -4), (4, -4), (-4, 4), (4, 4)]:
            holes |= ((X - (placket_x + hx))**2 + (Y - (by + hy))**2 <= hole_radius**2)

        # Thread cross
        thread_line = button_dish & (
            (np.abs((X - placket_x) - (Y - by)) <= 1) |
            (np.abs((X - placket_x) + (Y - by)) <= 1)
        ) & ((X - placket_x)**2 + (Y - by)**2 <= 6**2)

        overshirt_color_r[button_dish] = 30.0
        overshirt_color_g[button_dish] = 32.0
        overshirt_color_b[button_dish] = 36.0

        overshirt_color_r[button_rim] = 48.0
        overshirt_color_g[button_rim] = 52.0
        overshirt_color_b[button_rim] = 58.0

        overshirt_color_r[holes] = 10.0
        overshirt_color_g[holes] = 10.0
        overshirt_color_b[holes] = 12.0

        overshirt_color_r[thread_line] = 72.0
        overshirt_color_g[thread_line] = 76.0
        overshirt_color_b[thread_line] = 82.0

    # =========================================================================
    # 4. COMPOSITE FINAL BASE COLOR TEXTURE
    # =========================================================================
    final_color = color.copy()

    # Apply Inner T-Shirt
    final_color[tshirt_mask, 0] = tshirt_color_r[tshirt_mask]
    final_color[tshirt_mask, 1] = tshirt_color_g[tshirt_mask]
    final_color[tshirt_mask, 2] = tshirt_color_b[tshirt_mask]

    # Apply Outer Overshirt
    final_color[is_overshirt, 0] = overshirt_color_r[is_overshirt]
    final_color[is_overshirt, 1] = overshirt_color_g[is_overshirt]
    final_color[is_overshirt, 2] = overshirt_color_b[is_overshirt]

    final_color = np.clip(final_color, 0, 255).astype(np.uint8)
    final_color_img = Image.fromarray(final_color)
    final_color_img.save('public/models/A_M_Premium_Casual_color.webp', quality=95)
    final_color_img.save('public/models/A_M_Premium_Casual_color.png')
    print("Saved public/models/A_M_Premium_Casual_color.webp and .png")

    # =========================================================================
    # 5. NORMAL MAP ENHANCEMENT: TWILL MICRO-SURFACE & BUTTON EMBOSSING
    # =========================================================================
    final_nm = nm.copy()

    # Twill tangent normals
    twill_norm_x = np.cos((X + Y).astype(np.float32) * 1.25) * 6.0
    twill_norm_y = np.sin((X + Y).astype(np.float32) * 1.25) * 6.0
    final_nm[is_overshirt, 0] = np.clip(final_nm[is_overshirt, 0] + twill_norm_x[is_overshirt], 0, 255)
    final_nm[is_overshirt, 1] = np.clip(final_nm[is_overshirt, 1] + twill_norm_y[is_overshirt], 0, 255)

    # T-Shirt knit ribbing normal
    rib_norm_y = np.cos(Y.astype(np.float32) * 2.2) * 8.0
    final_nm[tshirt_mask, 1] = np.clip(final_nm[tshirt_mask, 1] + rib_norm_y[tshirt_mask], 0, 255)

    # Button bevel embossing in normal map
    for by in button_ys:
        dx = (X - placket_x).astype(np.float32)
        dy = (Y - by).astype(np.float32)
        dist = np.sqrt(dx**2 + dy**2)
        button_rim_zone = (dist <= button_radius) & (dist >= button_radius - 3) & is_overshirt

        norm_dir_x = (dx / np.maximum(1e-3, dist)) * 30.0
        norm_dir_y = (dy / np.maximum(1e-3, dist)) * 30.0

        final_nm[button_rim_zone, 0] = np.clip(128.0 + norm_dir_x[button_rim_zone], 0, 255)
        final_nm[button_rim_zone, 1] = np.clip(128.0 - norm_dir_y[button_rim_zone], 0, 255)

    final_nm = np.clip(final_nm, 0, 255).astype(np.uint8)
    final_nm_img = Image.fromarray(final_nm)
    final_nm_img.save('public/models/A_M_Premium_Casual_nm.webp', quality=95)
    final_nm_img.save('public/models/A_M_Premium_Casual_nm.png')
    print("Saved public/models/A_M_Premium_Casual_nm.webp and .png")

if __name__ == '__main__':
    build_clothing_textures()
