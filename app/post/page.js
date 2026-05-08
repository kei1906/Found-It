'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Loader2, ChevronDown, Check, Maximize2 } from 'lucide-react';
import ItemPostModal from '@/components/ItemPostModal';
import Cropper from 'react-easy-crop';

// --- CUSTOM DROPDOWN COMPONENT ---
function CustomSelect({ label, value, options, onChange, placeholder = "Select" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between text-white focus:border-orange-500/50 transition-all active:scale-[0.98]"
      >
        <span className={value ? "text-white" : "text-white/20"}>
          {value ? options.find(opt => opt.value === value)?.label || value : placeholder}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={16} className="text-orange-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 5, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute left-0 right-0 z-20 overflow-hidden rounded-2xl border border-white/20 bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl"
            >
              <div className="p-1 max-h-60 overflow-y-auto">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-white hover:bg-orange-500/20 transition-colors group text-left"
                  >
                    {opt.label}
                    {value === opt.value && <Check size={14} className="text-orange-400" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PostItemContent() {
  const searchParams = useSearchParams();
  const previewUrlFromUrl = searchParams.get('preview');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Found');
  const [locationTag, setLocationTag] = useState('');
  const [loading, setLoading] = useState(false);

  // --- CROP & IMAGE STATES ---
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [finalImage, setFinalImage] = useState(previewUrlFromUrl);

  // Synchronize state with URL changes (for when the modal redirects here)
  useEffect(() => {
    if (previewUrlFromUrl) {
      setFinalImage(previewUrlFromUrl);
      // Automatically open cropper if it's a fresh selection
      setIsCropping(true);
    }
  }, [previewUrlFromUrl]);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFileSelect = (file) => {
    const url = URL.createObjectURL(file);
    setFinalImage(url);
    // Push the file URL to query params so refreshing doesn't lose the image
    router.push(`/post?preview=${encodeURIComponent(url)}`);
    setIsCropping(true);
  };

  const getCroppedImg = async () => {
    try {
      const img = new Image();
      img.src = finalImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
      });
    } catch (e) {
      console.error("Cropping error:", e);
    }
  };

  const handleDoneAdjusting = async () => {
    if (!croppedAreaPixels) return setIsCropping(false);
    const blob = await getCroppedImg();
    if (blob) {
      const newPreview = URL.createObjectURL(blob);
      setFinalImage(newPreview);
    }
    setIsCropping(false);
  };

  const handlePost = async () => {
    if (!title || !description || !finalImage || !locationTag) {
      return alert("Please fill in all fields");
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to post.");

      // Fetch the blob from our local URL
      const fetchResponse = await fetch(finalImage);
      const blob = await fetchResponse.blob();
      const fileName = `${user.id}/${Date.now()}.jpg`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('items')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('items')
        .getPublicUrl(fileName);

      // 3. Insert Database Record
      const { error: dbError } = await supabase.from('items').insert([{
        title,
        description,
        image_url: publicUrl,
        user_id: user.id,
        category,
        location_tag: locationTag,
        status: 'Active'
      }]);

      if (dbError) throw dbError;

      router.push('/Home');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // If no image is provided, force open the Selection Modal
  if (!finalImage && !previewUrlFromUrl) {
    return (
      <ItemPostModal 
        open={true} 
        onClose={() => router.push('/Home')} 
        onFileSelect={handleFileSelect} 
      />
    );
  }

  return (
    <div className="min-h-screen text-white p-6 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/Home')} className="text-orange-400 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Post Report</h1>
      </header>

      {/* INTERACTIVE IMAGE CONTAINER */}
      <div className="relative w-full h-64 rounded-[2.5rem] overflow-hidden border border-white/10 mb-8 shadow-2xl group bg-black">
        {isCropping ? (
          <div className="absolute inset-0 z-50">
            <Cropper
              image={finalImage}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
            <button
              onClick={handleDoneAdjusting}
              className="absolute bottom-4 right-4 bg-orange-500 text-black px-6 py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all"
            >
              Apply Crop
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full cursor-pointer" onClick={() => setIsCropping(true)}>
            <img src={finalImage} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="bg-orange-500/90 backdrop-blur-md p-3 rounded-full shadow-lg">
                <Maximize2 size={20} className="text-black" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white drop-shadow-lg bg-black/40 px-3 py-1 rounded-full">Tap to adjust</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 max-w-md mx-auto pb-10">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">Item Title</label>
          <input 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500/30 transition-all placeholder:text-white/20" 
            placeholder="What did you find?" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CustomSelect 
            label="Category" 
            value={category} 
            options={[{ label: 'Lost', value: 'Lost' }, { label: 'Found', value: 'Found' }]} 
            onChange={setCategory} 
          />
          <CustomSelect 
            label="General Area" 
            value={locationTag} 
            options={[
              { label: 'Shed', value: 'Shed' }, 
              { label: 'Activity Center', value: 'Activity Center' }, 
              { label: 'ER Bldg.', value: 'ER Bldg.' }, 
              { label: 'ENB Bldg.', value: 'ENB Bldg.' }, 
              { label: 'Volleyball Court', value: 'Volleyball Court' }, 
              { label: 'Basketball Court', value: 'Basketball Court' }, 
              { label: 'Admin Bldg.', value: 'Admin Bldg.' }, 
              { label: 'Quadrangle', value: 'Quadrangle' }
            ]} 
            onChange={setLocationTag} 
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">Specific Details</label>
          <textarea 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl h-28 outline-none resize-none focus:border-orange-500/30 transition-all text-sm placeholder:text-white/20" 
            placeholder="Color, brand, unique features..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          />
        </div>

        <button 
          onClick={handlePost} 
          disabled={loading || isCropping} 
          className="w-full py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 bg-gradient-to-r from-orange-600 to-orange-400 hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-orange-900/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Submit Report</>}
        </button>
      </div>
    </div>
  );
}

export default function PostItem() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen" />}>
      <PostItemContent />
    </Suspense>
  );
}