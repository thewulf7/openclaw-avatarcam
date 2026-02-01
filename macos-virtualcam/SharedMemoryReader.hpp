#pragma once

#include <string>
#include <vector>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <iostream>

struct FrameHeader {
    int32_t magic;
    int32_t width;
    int32_t height;
    int64_t timestamp;
};

class SharedMemoryReader {
public:
    SharedMemoryReader(const std::string& path, int width, int height);
    ~SharedMemoryReader();

    bool Connect();
    bool GetLatestFrame(void* destBuffer, size_t bufferSize);

private:
    std::string path_;
    int width_;
    int height_;
    int fd_;
    void* mapped_ptr_;
    size_t total_size_;
    const int header_size_ = 20; // 4+4+4+8
};
