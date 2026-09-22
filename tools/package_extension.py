"""
Packaging script for PixelAuth Chrome Extension.
Creates a clean, distributable ZIP archive for Chrome Web Store / GitHub Releases.
"""

import os
import zipfile

def package_zip(output_path="dist/pixelauth-extension.zip"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Files and folders to include
    include_files = [
        "manifest.json",
        "LICENSE",
        "README.md",
        "PRIVACY.md",
        "CHROMEWEBSTORE.md"
    ]
    include_dirs = [
        "src",
        "assets"
    ]
    
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in include_files:
            if os.path.exists(f):
                zf.write(f, f)
                print(f"Added {f}")
        for d in include_dirs:
            for root, _, files in os.walk(d):
                for file in files:
                    full_path = os.path.join(root, file)
                    arc_name = os.path.relpath(full_path, ".")
                    zf.write(full_path, arc_name)
                    print(f"Added {arc_name}")
                    
    print(f"\nSuccessfully created {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == "__main__":
    package_zip()
