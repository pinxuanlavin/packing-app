"use client";
import { useEffect, useRef, useState } from "react";

const C = { danger: "#ef4444", muted: "#94a3b8", accent: "#3b82f6" };

export default function Scanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let codeReader: any = null;
    let stopped = false;
    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        codeReader = new BrowserMultiFormatReader();
        const devices = await codeReader.listVideoInputDevices();
        if (!devices.length) { setError("找不到摄像头"); return; }
        const back = devices.find((d: any) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        await codeReader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result: any) => {
          if (stopped || !result) return;
          stopped = true;
          codeReader?.reset();
          onScan(result.getText());
        });
      } catch (e: any) {
        setError("摄像头启动失败：" + e.message);
      }
    }
    start();
    return () => { stopped = true; codeReader?.reset(); };
  }, [onScan]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:480, padding:"0 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ color:"#fff", fontSize:16, fontWeight:600 }}>扫描面单条形码</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:24, cursor:"pointer" }}>✕</button>
        </div>
        {error ? (
          <div style={{ background:C.danger+"22", border:`1px solid ${C.danger}44`, borderRadius:12, padding:20, textAlign:"center", color:C.danger }}>{error}</div>
        ) : (
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", background:"#000" }}>
            <video ref={videoRef} style={{ width:"100%", display:"block" }} autoPlay playsInline muted />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:260, height:120, border:`2px solid ${C.accent}`, borderRadius:8, boxShadow:"0 0 0 2000px rgba(0,0,0,0.5)" }} />
            </div>
          </div>
        )}
        <div style={{ textAlign:"center", color:C.muted, fontSize:13, marginTop:16 }}>将条形码对准蓝色框内</div>
      </div>
    </div>
  );
}
