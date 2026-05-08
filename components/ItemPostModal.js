"use client";
import React, { useState, useRef, useEffect } from "react";
import { Camera, Image, X, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera as CameraPro } from "react-camera-pro";

export default function ItemPostModal({ open, onClose, onFileSelect }) {
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [numberOfCameras, setNumberOfCameras] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraContainerRef = useRef(null);
  const [error, setError] = useState(null);
  const cameraRef = useRef(null);

  // Reset modal state on close
  useEffect(() => {
    if (!open) {
      setShowLiveCamera(false);
      setError(null);
      setIsCameraReady(false);
      setNumberOfCameras(0);
    }
  }, [open]);

  if (!open) return null;

  const handleTakePhoto = async () => {
    try {
      if (cameraRef.current) {
        const photoData = cameraRef.current.takePhoto();
        const res = await fetch(photoData);
        const blob = await res.blob();
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onFileSelect(file);
        onClose();
      }
    } catch (err) {
      setError("Failed to process photo. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center backdrop-blur-xl p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-[#0a0a0a] border border-orange-500/30 rounded-[2.5rem] w-full max-w-md overflow-hidden relative shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">
            {showLiveCamera ? "Camera" : "Add Image"}
          </h2>
          <button onClick={onClose} className="text-orange-400 p-2 hover:bg-white/5 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="relative min-h-[350px] bg-black flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!showLiveCamera ? (
              <motion.div key="menu" className="p-8 grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={() => setShowLiveCamera(true)}
                  className="flex flex-col items-center gap-4 p-8 bg-white/5 border border-orange-500/20 rounded-3xl cursor-pointer hover:bg-orange-500/10 transition-all"
                >
                  <Camera size={32} className="text-orange-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Live Camera</span>
                </button>

                <label className="flex flex-col items-center gap-4 p-8 bg-white/5 border border-orange-500/20 rounded-3xl cursor-pointer hover:bg-orange-500/10 transition-all">
                  <Image size={32} className="text-orange-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Gallery</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      if(e.target.files?.[0]) { onFileSelect(e.target.files[0]); onClose(); }
                    }} 
                  />
                </label>
              </motion.div>
            ) : (
              <motion.div key="cam" className="w-full aspect-[3/4] relative overflow-hidden">
                {error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black z-50">
                    <AlertTriangle className="text-orange-500 mb-4" size={48} />
                    <p className="text-xs text-white/40 mb-6">{error}</p>
                    <button onClick={() => setShowLiveCamera(false)} className="px-6 py-3 bg-orange-500/10 text-orange-400 rounded-2xl text-xs font-bold border border-orange-500/20">Go Back</button>
                  </div>
                ) : (
                  <>
                    {!isCameraReady && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black">
                        <Loader2 className="text-orange-400 animate-spin mb-2" size={32} />
                        <p className="text-[10px] uppercase font-black text-orange-400/40 tracking-widest">Initializing...</p>
                      </div>
                    )}
                    <CameraPro 
                      ref={cameraRef} 
                      aspectRatio={0.75} 
                      facingMode="environment"
                      numberOfCamerasCallback={(n) => {
                        setNumberOfCameras(n);
                        if (n >= 0) setIsCameraReady(true);
                      }}
                      errorMessages={{
                        noCameraAccessible: "No camera found on this device.",
                        permissionDenied: "Camera access denied. Please allow camera permission in your browser settings.",
                        switchCamera: "Cannot switch camera — only one camera is available.",
                        canvas: "Your browser does not support canvas.",
                      }}
                    />
                  </>
                )}
                
                {isCameraReady && !error && (
                  <div className="absolute bottom-8 left-0 right-0 flex items-center justify-between px-10 z-30">
                    <button 
                      type="button"
                      onClick={() => cameraRef.current?.switchCamera()} 
                      className={`p-4 bg-black/40 rounded-full text-white border border-white/10 active:scale-90 transition-transform ${numberOfCameras <= 1 ? 'opacity-0' : 'opacity-100'}`}
                    >
                      <RefreshCw size={22} />
                    </button>

                    <button 
                      type="button"
                      onClick={handleTakePhoto}
                      className="w-20 h-20 bg-orange-500 rounded-full border-[6px] border-white/20 shadow-2xl active:scale-90 transition-transform"
                    />
                    <div className="w-14" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}