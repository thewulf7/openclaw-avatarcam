#include "SharedMemoryReader.hpp"
#include <cstring>

SharedMemoryReader::SharedMemoryReader(const std::string& path, int width, int height)
    : path_(path), width_(width), height_(height), fd_(-1), mapped_ptr_(MAP_FAILED) {
    size_t frame_size = width * height * 4;
    total_size_ = header_size_ + frame_size;
}

SharedMemoryReader::~SharedMemoryReader() {
    if (mapped_ptr_ != MAP_FAILED) {
        munmap(mapped_ptr_, total_size_);
    }
    if (fd_ != -1) {
        close(fd_);
    }
}

bool SharedMemoryReader::Connect() {
    // Try to open the shared memory file
    // Note: In a real plugin, this should retry or handle failure gracefully without crashing
    fd_ = open(path_.c_str(), O_RDONLY);
    if (fd_ == -1) {
        return false;
    }

    mapped_ptr_ = mmap(nullptr, total_size_, PROT_READ, MAP_SHARED, fd_, 0);
    if (mapped_ptr_ == MAP_FAILED) {
        close(fd_);
        fd_ = -1;
        return false;
    }
    
    return true;
}

bool SharedMemoryReader::GetLatestFrame(void* destBuffer, size_t bufferSize) {
    if (mapped_ptr_ == MAP_FAILED) {
        if (!Connect()) return false;
    }

    uint8_t* ptr = static_cast<uint8_t*>(mapped_ptr_);
    FrameHeader* header = reinterpret_cast<FrameHeader*>(ptr);

    // Basic validation
    if (header->magic != 0x0CA7CA7) return false;
    if (header->width != width_ || header->height != height_) return false;

    // Copy data
    // Data starts at offset 20
    const uint8_t* srcData = ptr + header_size_;
    size_t copySize = std::min(bufferSize, total_size_ - header_size_);
    
    memcpy(destBuffer, srcData, copySize);
    return true;
}
