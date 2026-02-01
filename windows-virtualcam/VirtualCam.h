#pragma once
#include <streams.h>

class CVCamStream : public CSourceStream {
public:
  CVCamStream(HRESULT *phr, CSource *p_ms, LPCWSTR p_name);
  virtual ~CVCamStream();

  // CSourceStream
  HRESULT GetMediaType(int iPosition, CMediaType *pmt);
  HRESULT CheckMediaType(const CMediaType *pMediaType);
  HRESULT DecideBufferSize(IMemAllocator *pIMemAlloc,
                           ALLOCATOR_PROPERTIES *pProperties);
  HRESULT FillBuffer(IMediaSample *pms);
  HRESULT OnThreadCreate();
  HRESULT OnThreadDestroy();

private:
  HANDLE m_hMapFile;
  LPVOID m_pMapAddress;
  int m_width;
  int m_height;
};

class CVCam : public CSource {
public:
  static CUnknown *WINAPI CreateInstance(LPUNKNOWN lpunk, HRESULT *phr);
  STDMETHODIMP QueryInterface(REFIID riid, void **ppv);

  DECLARE_IUNKNOWN;

private:
  CVCam(LPUNKNOWN lpunk, HRESULT *phr);
};
