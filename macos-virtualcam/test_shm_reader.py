import mmap
import os
import struct
import time

def test_shared_memory_layout():
    """
    Simulates the C++ SharedMemoryReader reading a file created by (simulated) Unity.
    Verifies that the byte offsets and structure match expectations.
    Structure:
    - Magic (4 bytes, int32)
    - Width (4 bytes, int32)
    - Height (4 bytes, int32)
    - Timestamp (8 bytes, int64)
    - Data (Width * Height * 4 bytes)
    """
    
    SHM_PATH = "/tmp/openclaw_test_shm"
    WIDTH = 1280
    HEIGHT = 720
    MAGIC = 0x0CA7CA7
    HEADER_SIZE = 20
    FRAME_SIZE = WIDTH * HEIGHT * 4
    TOTAL_SIZE = HEADER_SIZE + FRAME_SIZE
    
    # 1. Simulate Unity creating the file
    with open(SHM_PATH, "wb") as f:
        f.write(b'\0' * TOTAL_SIZE)
        
    with open(SHM_PATH, "r+b") as f:
        mm = mmap.mmap(f.fileno(), TOTAL_SIZE)
        
        # Write Header
        # <iiiq = little endian int, int, int, long long
        header_data = struct.pack('<iiiq', MAGIC, WIDTH, HEIGHT, int(time.time() * 1000))
        mm[0:HEADER_SIZE] = header_data
        
        # Write some pixel data (first pixel Red: BGRA = 0,0,255,255)
        pixel_data = struct.pack('BBBB', 0, 0, 255, 255) # Blue, Green, Red, Alpha
        mm[HEADER_SIZE:HEADER_SIZE+4] = pixel_data
        
        mm.flush()
        mm.close()
        
    # 2. Simulate C++ Reader (reading back)
    with open(SHM_PATH, "rb") as f:
        data = f.read(TOTAL_SIZE)
        
        # precise matching of indices
        r_magic, r_width, r_height, r_timestamp = struct.unpack('<iiiq', data[0:HEADER_SIZE])
        
        print(f"Read Magic: {hex(r_magic)}")
        
        assert r_magic == MAGIC, "Magic number mismatch"
        assert r_width == WIDTH, "Width mismatch"
        assert r_height == HEIGHT, "Height mismatch"
        
        # Check first pixel
        b, g, r, a = struct.unpack('BBBB', data[HEADER_SIZE:HEADER_SIZE+4])
        assert r == 255, "Red channel incorrect"
        assert a == 255, "Alpha channel incorrect"
        
    print("Shared Memory Verification Passed")
    
    # cleanup
    if os.path.exists(SHM_PATH):
        os.remove(SHM_PATH)

if __name__ == "__main__":
    test_shared_memory_layout()
