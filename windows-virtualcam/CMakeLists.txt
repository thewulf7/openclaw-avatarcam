cmake_minimum_required(VERSION 3.10)
project(OpenClawAvatarCam)

set(CMAKE_CXX_STANDARD 17)

# Windows specific
if(WIN32)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
    
    # You need the DirectShow BaseClasses library (strmbase.lib / strmbasd.lib)
    # This is often the hardest part of building DS filters nowadays.
    # Users often use https://github.com/roman380/tm_baseclasses to build it.
    
    include_directories(SYSTEM "baseclasses/src") 
    
    add_library(OpenClawAvatarCam SHARED
        VirtualCam.cpp
        VirtualCam.h
        DllEntry.cpp
        VirtualCam.def # Optional if we export via header
    )

    target_link_libraries(OpenClawAvatarCam
        strmiids
        uuid
        winmm
        # strmbase.lib # Path needs to be set by user
    )
    
    # Define exports
    set_target_properties(OpenClawAvatarCam PROPERTIES SUFFIX ".dll")

endif()
