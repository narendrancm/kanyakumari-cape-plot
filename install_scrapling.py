import sys
import subprocess

def install_and_setup():
    print("=" * 50)
    print("Scrapling AI Setup & Installer")
    print(f"Python: {sys.executable}")
    print("=" * 50)

    # 1. Install scrapling[ai]
    print("\n[Step 1/2] Installing scrapling[ai] via pip...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "scrapling[ai]"])
        print("\n>>> scrapling[ai] installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"\n[!] Failed to install scrapling[ai]: {e}")
        return

    # 2. Test import
    print("\n[Step 2/2] Verifying installation...")
    try:
        import scrapling
        print(f">>> Scrapling version: {getattr(scrapling, '__version__', 'Installed')}")
        print("\n[SUCCESS] Setup is complete! You can now run `scraper_demo.py`.")
    except ImportError as e:
        print(f"\n[!] Verification failed: {e}")

if __name__ == "__main__":
    install_and_setup()
