!macro NSIS_HOOK_PREINSTALL
  !if /FileExists "..\..\WebView2Loader.dll"
    File "/oname=WebView2Loader.dll" "..\..\WebView2Loader.dll"
  !endif
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\WebView2Loader.dll"
!macroend
