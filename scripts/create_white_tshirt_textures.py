import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def generate_production_white_tshirt_textures():
    print("Loading original source textures from VALID asset...")
    color_img = Image.open('scratch/medi_img_1.webp').convert('RGB')
    nm_img = Image.open('scratch/medi_img_0.webp').convert('RGB')

    w, h = color_img.size
    color = np.array(color_img, dtype=np.float32)
    nm = np.array(nm_img, dtype=np.float32)

    Y, X = np.mgrid[:h, :w]
    r_orig, g_orig, b_orig = color[:, :, 0], color[:, :, 1], color[:, :, 2]

    # =========================================================================
    # 1. ANATOMICAL PROTECTION (Strictly preserve face, skin, eyes, hair, teeth, mouth, pants)
    # =========================================================================
    is_eyes = (Y < 220) & ((X < 450) | ((X > 850) & (X < 1200)))
    is_hair = (Y < 550) & (X < 1150)
    is_pants = (X >= 480) & (X <= 1100) & (Y >= 1260)
    is_skin_face = (Y < 860) & (X < 1050) & (r_orig > b_orig + 10)
    is_mouth = (Y >= 1350) & (Y <= 1650) & (X >= 1940) & (r_orig > b_orig + 10)
    is_teeth = (Y > 1850) & (X > 500) & (X < 1100)
    is_hands = ((X < 450) & (Y > 1150) & (Y < 1550)) | ((X >= 1150) & (X <= 1550) & (Y < 500))

    is_protected_dilation = is_eyes | is_hair | is_pants | is_skin_face | is_mouth | is_teeth | is_hands

    # =========================================================================
    # 2. COMPLETE T-SHIRT SURFACE MASK (Torso, Both Sleeves, Shoulders, Collar)
    # =========================================================================
    # Capture 100% of blue shirt fabric across the entire character
    is_shirt_blue = (b_orig > 35) & (b_orig > r_orig + 2) & (b_orig > g_orig - 25) & ~is_eyes & ~is_hair & ~is_pants

    # Chest V opening island (seamless single fabric plane):
    is_chest_v = (X >= 1740) & (X <= 1980) & (Y >= 1370) & (Y <= 1630) & (r_orig < 220) & (b_orig > 45)

    is_tshirt = is_shirt_blue | is_chest_v

    # Dilate 3px to guarantee seamless closure at boundaries
    tshirt_pil = Image.fromarray(is_tshirt.astype(np.uint8) * 255)
    tshirt_dilated = np.array(tshirt_pil.filter(ImageFilter.MaxFilter(7))) > 128
    is_tshirt = tshirt_dilated & ~is_protected_dilation

    print(f"Total T-shirt mask pixels: {np.sum(is_tshirt)}")

    # =========================================================================
    # 3. PHOTOREALISTIC WHITE COTTON JERSEY MATERIAL SYNTHESIS
    # =========================================================================
    # Base tone: curated neutral premium cotton jersey (#EAE9E4 -> RGB: 234, 233, 228)
    # Soft, natural, non-emissive white with rich depth
    orig_lum = 0.299 * r_orig + 0.587 * g_orig + 0.114 * b_orig
    mean_lum = np.mean(orig_lum[is_tshirt])

    # Relative fold shading: soft compression so fabric folds remain distinct and anatomical
    # while contact shadows stay realistic (0.70 to 1.15)
    relative_folds = np.clip(orig_lum / max(1.0, mean_lum), 0.45, 1.45)
    relative_folds = np.power(relative_folds, 0.52)

    # Feathered smooth blend across the old V-neck seam zone so folds flow seamlessly
    # without any harsh rectangular boundaries
    smooth_lum = Image.fromarray((relative_folds * 100.0).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16))
    smooth_lum_arr = np.array(smooth_lum, dtype=np.float32) / 100.0
    v_mask = np.zeros((h, w), dtype=np.float32)
    v_mask[(X >= 1630) & (X <= 1950) & (Y >= 1380) & (Y <= 1620)] = 1.0
    v_mask_smooth = np.array(Image.fromarray((v_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), dtype=np.float32) / 255.0
    relative_folds = relative_folds * (1.0 - v_mask_smooth) + smooth_lum_arr * v_mask_smooth
    is_v_seam_zone = v_mask_smooth > 0.05

    # Fine Cotton Jersey Knit Micro-Texture (interlaced thread loops)
    knit_grain = 1.0 + 0.018 * (np.sin(X.astype(np.float32) * 1.6) * np.cos(Y.astype(np.float32) * 1.6))
    np.random.seed(1337)
    cotton_fiber_noise = 1.0 + 0.012 * (np.random.rand(h, w) - 0.5)

    base_r = 236.0
    base_g = 235.0
    base_b = 230.0

    tshirt_r = np.clip(base_r * relative_folds * knit_grain * cotton_fiber_noise, 175.0, 246.0)
    tshirt_g = np.clip(base_g * relative_folds * knit_grain * cotton_fiber_noise, 175.0, 246.0)
    tshirt_b = np.clip(base_b * relative_folds * knit_grain * cotton_fiber_noise, 170.0, 242.0)

    # =========================================================================
    # 4. CREW-NECK COLLAR RIB BAND & SUBTLE STITCHING
    # =========================================================================
    # Crew-neck collar rib band along front and back neckline rims
    is_collar_rim = (
        (((X >= 1740) & (X <= 1790) & (Y >= 1380) & (Y <= 1620)) |
         ((Y >= 1040) & (Y <= 1090) & (X >= 500) & (X <= 1000)) |
         ((Y >= 910) & (Y <= 960) & (X >= 180) & (X <= 300))) &
        is_tshirt
    )
    # Fine 1x1 elastic rib-knit texture along collar band
    rib_knit = 1.0 + 0.035 * np.sin(X.astype(np.float32) * 2.5)
    tshirt_r[is_collar_rim] = np.clip(tshirt_r[is_collar_rim] * rib_knit[is_collar_rim], 175.0, 246.0)
    tshirt_g[is_collar_rim] = np.clip(tshirt_g[is_collar_rim] * rib_knit[is_collar_rim], 175.0, 246.0)
    tshirt_b[is_collar_rim] = np.clip(tshirt_b[is_collar_rim] * rib_knit[is_collar_rim], 170.0, 242.0)

    # Sleeve hem twin-needle stitching:
    sleeve_stitch = ((Y >= 770) & (Y <= 773) & (X >= 1250) & (X <= 1700) & is_tshirt & (X % 6 < 3))
    tshirt_r[sleeve_stitch] = 205.0
    tshirt_g[sleeve_stitch] = 205.0
    tshirt_b[sleeve_stitch] = 200.0

    # =========================================================================
    # 5. COMPOSITE BASE COLOR
    # =========================================================================
    final_color = color.copy()
    final_color[is_tshirt, 0] = tshirt_r[is_tshirt]
    final_color[is_tshirt, 1] = tshirt_g[is_tshirt]
    final_color[is_tshirt, 2] = tshirt_b[is_tshirt]

    final_color = np.clip(final_color, 0, 255).astype(np.uint8)
    color_img = Image.fromarray(final_color)

    # =========================================================================
    # 6. GRAPHMIND BRANDING (Avenir Heavy / Clean Sans-Serif)
    # =========================================================================
    brand_text = 'GraphMind'
    # Try Avenir Heavy (clean, modern, architectural sans-serif)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Avenir.ttc', 36, index=4)
        print("Using font: Avenir Heavy")
    except:
        try:
            font = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', 36, index=1)
            print("Using font: Helvetica Neue Bold")
        except:
            font = ImageFont.load_default()
            print("Using font: default fallback")

    bbox = font.getbbox(brand_text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    print(f"GraphMind text dimensions: {tw} x {th}")

    # Render anti-aliased text patch with tight padding
    pad = 6
    txt_patch = Image.new('RGBA', (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    txt_draw = ImageDraw.Draw(txt_patch)
    # Dark charcoal / near-black lettering (#202226 -> RGB: 32, 34, 38)
    txt_draw.text((pad - bbox[0], pad - bbox[1]), brand_text, fill=(32, 34, 38, 255), font=font)

    # Rotate 270 degrees clockwise to align with chest UV orientation
    rot_txt_patch = txt_patch.transpose(Image.ROTATE_270)
    print(f"Rotated text patch size: {rot_txt_patch.size}")

    # Center text horizontally on chest at pxY = 1491, upper chest at pxX = 1725 (comfortably within torso island)
    center_x = 1725
    center_y = 1491
    paste_x = int(center_x - rot_txt_patch.width / 2)
    paste_y = int(center_y - rot_txt_patch.height / 2)
    print(f"Pasting GraphMind text at ({paste_x}, {paste_y}) to ({paste_x + rot_txt_patch.width}, {paste_y + rot_txt_patch.height})")

    color_img.paste(rot_txt_patch, (paste_x, paste_y), rot_txt_patch)

    # Save final base color textures
    color_img.save('public/models/A_M_White_TShirt_color.webp', quality=95)
    color_img.save('public/models/A_M_White_TShirt_color.png')
    print("Saved public/models/A_M_White_TShirt_color.webp and .png")

    # =========================================================================
    # 7. PHOTOREALISTIC NORMAL MAP WITH FINE FABRIC GRAIN & EMBOSSED INK
    # =========================================================================
    final_nm = nm.copy()

    # Cotton jersey fine micro-normal perturbation (subtle thread weave)
    knit_nx = np.sin(X.astype(np.float32) * 1.6) * 3.5
    knit_ny = np.cos(Y.astype(np.float32) * 1.6) * 3.5
    final_nm[is_tshirt, 0] = np.clip(final_nm[is_tshirt, 0] + knit_nx[is_tshirt], 0, 255)
    final_nm[is_tshirt, 1] = np.clip(final_nm[is_tshirt, 1] + knit_ny[is_tshirt], 0, 255)

    # Smooth out the old V-neck seam ridge in the normal map across the entire V zone
    smooth_nm_x = Image.fromarray(final_nm[:, :, 0].astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    smooth_nm_y = Image.fromarray(final_nm[:, :, 1].astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    final_nm[is_v_seam_zone, 0] = np.array(smooth_nm_x)[is_v_seam_zone]
    final_nm[is_v_seam_zone, 1] = np.array(smooth_nm_y)[is_v_seam_zone]
    final_nm[is_v_seam_zone, 2] = 255.0

    # Normal map embossing for printed "GraphMind" ink (subtle screen-print ink bevel)
    txt_mask = np.array(rot_txt_patch)[:, :, 3] > 64
    ph, pw = txt_mask.shape
    for py in range(ph):
        for px in range(pw):
            if txt_mask[py, px]:
                final_nm[paste_y + py, paste_x + px, 2] = 248.0

    final_nm = np.clip(final_nm, 0, 255).astype(np.uint8)
    nm_img = Image.fromarray(final_nm)
    nm_img.save('public/models/A_M_White_TShirt_nm.webp', quality=95)
    nm_img.save('public/models/A_M_White_TShirt_nm.png')
    print("Saved public/models/A_M_White_TShirt_nm.webp and .png")

if __name__ == '__main__':
    generate_production_white_tshirt_textures()
