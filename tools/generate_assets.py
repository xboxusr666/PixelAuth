"""
Asset generation script for PixelAuth by JTS Software.
Generates pixel-art icons at 16x16, 32x32, 48x48, and 128x128 px,
as well as Chrome Web Store promotional banners.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_base_icon_matrix():
    """
    16x16 pixel art shield with keyhole / lock motif.
    Characters:
    . = transparent
    B = dark border (#0f172a)
    S = shield outer emerald (#10b981)
    C = shield cyan glow (#06b6d4)
    K = key/lock gold (#f59e0b)
    Y = bright yellow highlight (#fef08a)
    W = white spark (#ffffff)
    D = deep emerald (#047857)
    """
    matrix = [
        "....BBBBBBBB....",
        "...BSSSSSSSSB...",
        "..BSSSSWWSSSSB..",
        ".BSSCCDYYDCCSSB.",
        ".BSCCDYKKYDCCSB.",
        ".BSCDYKKKKYDCSB.",
        ".BSCDYKWWKYDCSB.",
        ".BSCDYKKKKYDCSB.",
        ".BSCCDYKKDCCCSB.",
        "..BSCDDKKDDCSB..",
        "..BSCCDKKDCCSB..",
        "...BSCDKKDCSB...",
        "....BSCKKCSB....",
        ".....BSDDCSB.....",
        "......BSCCB.....",
        ".......BBB......",
    ]
    
    color_map = {
        '.': (0, 0, 0, 0),
        'B': (15, 23, 42, 255),      # Dark border
        'S': (16, 185, 129, 255),   # Emerald green
        'D': (4, 120, 87, 255),     # Dark emerald
        'C': (6, 182, 212, 255),    # Cyan glow
        'K': (245, 158, 11, 255),   # Amber/gold
        'Y': (254, 240, 138, 255),  # Light yellow
        'W': (255, 255, 255, 255),  # White highlight
    }
    
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(matrix):
        for x, char in enumerate(row):
            if x < 16 and y < 16:
                img.putpixel((x, y), color_map.get(char, (0, 0, 0, 0)))
    return img

def generate_icons():
    base = create_base_icon_matrix()
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        # Scale with nearest neighbor for crisp authentic pixel art
        scaled = base.resize((size, size), Image.Resampling.NEAREST)
        path = os.path.join("assets", "icons", f"icon-{size}.png")
        scaled.save(path, "PNG")
        print(f"Generated {path} ({size}x{size})")

def generate_promo_banner():
    """Generates a 440x280 small promo tile with pixel aesthetics."""
    width, height = 440, 280
    banner = Image.new("RGBA", (width, height), (15, 23, 42, 255))
    draw = ImageDraw.Draw(banner)
    
    # Draw subtle pixel grid / stars in background
    for y in range(0, height, 16):
        draw.line([(0, y), (width, y)], fill=(30, 41, 59, 120), width=1)
    for x in range(0, width, 16):
        draw.line([(x, 0), (x, height)], fill=(30, 41, 59, 120), width=1)
        
    # Draw a pixel frame
    draw.rectangle([8, 8, width-9, height-9], outline=(51, 65, 85, 255), width=2)
    draw.rectangle([12, 12, width-13, height-13], outline=(16, 185, 129, 200), width=1)
    
    # Paste enlarged icon
    base_icon = create_base_icon_matrix()
    icon_96 = base_icon.resize((96, 96), Image.Resampling.NEAREST)
    banner.paste(icon_96, (40, 92), icon_96)
    
    # Draw Title and Tagline
    # Use default font since custom fonts might not be installed
    draw.text((160, 90), "PixelAuth", fill=(52, 211, 153, 255))
    draw.text((160, 125), "Secure MFA Authenticator Wallet", fill=(241, 245, 249, 255))
    draw.text((160, 155), "* Encrypted AES-256-GCM Vault", fill=(148, 163, 184, 255))
    draw.text((160, 175), "* On-Page QR Code Scanner", fill=(148, 163, 184, 255))
    draw.text((160, 195), "* Import from Google, Aegis, 2FAS", fill=(148, 163, 184, 255))
    draw.text((160, 225), "By JTS Software | GPL 3.0", fill=(100, 116, 139, 255))
    
    banner.save(os.path.join("assets", "promo", "banner.png"), "PNG")
    print("Generated assets/promo/banner.png (440x280)")

def generate_marquee_banner():
    """Generates a 1400x560 large promo marquee with pixel aesthetics."""
    width, height = 1400, 560
    marquee = Image.new("RGBA", (width, height), (15, 23, 42, 255))
    draw = ImageDraw.Draw(marquee)
    
    # Subtle pixel grid
    for y in range(0, height, 24):
        draw.line([(0, y), (width, y)], fill=(30, 41, 59, 100), width=1)
    for x in range(0, width, 24):
        draw.line([(x, 0), (x, height)], fill=(30, 41, 59, 100), width=1)
        
    draw.rectangle([20, 20, width-21, height-21], outline=(51, 65, 85, 255), width=4)
    draw.rectangle([28, 28, width-29, height-29], outline=(16, 185, 129, 220), width=2)
    
    # Paste 224x224 icon
    base_icon = create_base_icon_matrix()
    icon_224 = base_icon.resize((224, 224), Image.Resampling.NEAREST)
    marquee.paste(icon_224, (100, 168), icon_224)
    
    # Text block
    draw.text((380, 160), "PixelAuth", fill=(52, 211, 153, 255))
    draw.text((380, 220), "Next-Generation MFA Authenticator Wallet for Chrome", fill=(241, 245, 249, 255))
    draw.text((380, 280), "> Client-Side Zero-Knowledge Encryption (AES-GCM-256 + PBKDF2)", fill=(148, 163, 184, 255))
    draw.text((380, 315), "> Direct On-Page QR Code Snip & Screen Capture", fill=(148, 163, 184, 255))
    draw.text((380, 350), "> Multi-App Import/Export (Google Authenticator, Aegis, 2FAS, Bitwarden)", fill=(148, 163, 184, 255))
    draw.text((380, 385), "> Session Unlock Bypass & Configurable Inactivity Auto-Lock", fill=(148, 163, 184, 255))
    draw.text((380, 440), "100% Offline & Open Source | By JTS Software | GNU GPL 3.0", fill=(100, 116, 139, 255))
    
    marquee.save(os.path.join("assets", "promo", "marquee.png"), "PNG")
    print("Generated assets/promo/marquee.png (1400x560)")

if __name__ == "__main__":
    generate_icons()
    generate_promo_banner()
    generate_marquee_banner()
    print("All assets generated successfully!")
