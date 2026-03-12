from rembg import remove
from PIL import Image
import io
import sys
import os

def process_precise_ui_asset(input_path, output_path, target_width, target_height):
    """
    Deterministic UI/UX Asset Automation Engine.
    Executes a strict post-processing pipeline to output pixel-perfect transparent PNGs.
    """
    print(f"Processing {input_path} -> {output_path} ({target_width}x{target_height})")
    
    # 1. Load raw generation
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found.")
        sys.exit(1)
        
    with open(input_path, 'rb') as f:
        input_data = f.read()

    # 2. Isolate via U2-Net with alpha matting disabled for sharper UI edges
    print("Removing background...")
    isolated_data = remove(input_data, alpha_matting=False)
    img = Image.open(io.BytesIO(isolated_data)).convert("RGBA")

    # 3. Alpha Thresholding for Absolute Bounding Box
    print("Cleaning alpha channel...")
    alpha = img.split()[-1]
    alpha_data = alpha.load()
    for y in range(img.height):
        for x in range(img.width):
            if alpha_data[x, y] < 25:  # Strict threshold: anything under ~10% opacity is deleted
                alpha_data[x, y] = 0
    
    # Update image with cleaned alpha
    img.putalpha(alpha)
    
    # 4. Trim dead space using the purified alpha channel
    bbox = img.getbbox()
    if not bbox:
        raise ValueError("Asset generation failed: No solid pixels found after background removal.")
    img = img.crop(bbox)

    # 5. Conform: Aspect-Ratio Locked Scaling
    print("Scaling and centering...")
    img.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
    
    # 6. Canvas Creation & Integer Centering
    final_img = Image.new('RGBA', (target_width, target_height), (0, 0, 0, 0))
    
    # Calculate offset using integer division (//) to prevent sub-pixel blurring
    offset_x = (target_width - img.width) // 2
    offset_y = (target_height - img.height) // 2
    
    final_img.paste(img, (offset_x, offset_y))
    
    # 7. Export with maximum compression for UI performance
    final_img.save(output_path, 'PNG', optimize=True)
    print("Processing complete.")

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python process_asset.py <input> <output> <width> <height>")
        sys.exit(1)
        
    process_precise_ui_asset(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
