'use client'
import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Download } from 'lucide-react';

interface Gradient {
  startColor: string;
  endColor: string;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface ColorMap {
  [key: string]: number;
}

const ImageGradientGenerator = () => {
  const [image, setImage] = useState<string | null>(null);
  const [gradient, setGradient] = useState<Gradient | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract dominant colors from image
  const extractColors = useCallback((imgElement: HTMLImageElement): Gradient => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { startColor: '#000000', endColor: '#444444' };
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { startColor: '#000000', endColor: '#444444' };
    }

    // Set canvas size to match image
    canvas.width = imgElement.width;
    canvas.height = imgElement.height;

    // Draw image to canvas
    ctx.drawImage(imgElement, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Color frequency map
    const colorMap: ColorMap = {};
    const step = 4; // Sample every nth pixel for performance

    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      // Reduce color precision to group similar colors
      const reducedR = Math.floor(r / 32) * 32;
      const reducedG = Math.floor(g / 32) * 32;
      const reducedB = Math.floor(b / 32) * 32;

      const colorKey = `${reducedR},${reducedG},${reducedB}`;
      colorMap[colorKey] = (colorMap[colorKey] || 0) + 1;
    }

    // Sort colors by frequency
    const sortedColors = Object.entries(colorMap)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([color]) => {
        const [r, g, b] = color.split(',').map(Number);
        return { r, g, b };
      });

    if (sortedColors.length === 0) {
      return { startColor: '#000000', endColor: '#444444' };
    }

    // Get dominant and accent colors
    const dominantColor = sortedColors[0];
    const accentColor = sortedColors[Math.min(3, sortedColors.length - 1)] || dominantColor;

    // Calculate saturation and brightness
    const getSaturation = (color: Color): number => {
      const max = Math.max(color.r, color.g, color.b);
      const min = Math.min(color.r, color.g, color.b);
      return max === 0 ? 0 : ((max - min) / max) * 100;
    };

    const getBrightness = (color: Color): number => {
      return Math.max(color.r, color.g, color.b) / 255 * 100; // Use max instead of weighted average
    };

    const dominantSaturation = getSaturation(dominantColor);
    const dominantBrightness = getBrightness(dominantColor);

    // Also check if ANY of the top colors are saturated (not just the dominant)
    const hasVibrancy = sortedColors.slice(0, 5).some(color => getSaturation(color) > 30);

    // Determine if image is moody/grayscale
    // Fixed: Prioritize saturation over brightness for colorful images
    const isMoody = dominantSaturation < 20 && dominantBrightness < 60 && !hasVibrancy;

    let startColor: string, endColor: string;

    if (isMoody) {
      // Use black-gray gradient for low saturation images
      startColor = '#000000';
      endColor = '#666666';
    } else {
      // Create gradient from dominant colors
      const darkenColor = (color: Color, factor = 0.3): Color => {
        return {
          r: Math.floor(color.r * (1 - factor)),
          g: Math.floor(color.g * (1 - factor)),
          b: Math.floor(color.b * (1 - factor))
        };
      };

      const lightenColor = (color: Color, factor = 0.3): Color => {
        return {
          r: Math.min(255, Math.floor(color.r * (1 + factor))),
          g: Math.min(255, Math.floor(color.g * (1 + factor))),
          b: Math.min(255, Math.floor(color.b * (1 + factor)))
        };
      };

      const darkDominant = darkenColor(dominantColor);
      const lightAccent = lightenColor(accentColor);

      startColor = `rgb(${darkDominant.r}, ${darkDominant.g}, ${darkDominant.b})`;
      endColor = `rgb(${lightAccent.r}, ${lightAccent.g}, ${lightAccent.b})`;
    }

    return { startColor, endColor };
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') return;
      
      const img = new Image();
      img.onload = () => {
        setImage(result);
        const colors = extractColors(img);
        setGradient(colors);
        setIsProcessing(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, [extractColors]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      // Create a proper file input event
      const input = fileInputRef.current;
      if (input) {
        // Create a new FileList-like object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        
        // Trigger the change event
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const clearImage = () => {
    setImage(null);
    setGradient(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyGradientCSS = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!gradient) return;

    const css = `background: linear-gradient(135deg, ${gradient.startColor}, ${gradient.endColor});`;
    navigator.clipboard.writeText(css);

    // Show temporary feedback
    const button = event.currentTarget;
    const originalText = button.textContent;
    if (originalText) {
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Image Gradient Generator
          </h1>
          <p className="text-gray-600">
            Upload an image to generate a contextual gradient like Genius
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Image</h2>

              {!image ? (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">
                    Drop an image here or click to upload
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports JPG, PNG, GIF up to 10MB
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={image}
                    alt="Uploaded"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {isProcessing && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">Processing image...</p>
                </div>
              )}
            </div>
          </div>

          {/* Gradient Preview Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Generated Gradient</h2>

              {gradient ? (
                <div className="space-y-4">
                  <div
                    className="w-full h-64 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${gradient.startColor}, ${gradient.endColor})`
                    }}
                  ></div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: gradient.startColor }}
                      ></div>
                      <span className="font-mono text-sm">{gradient.startColor}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: gradient.endColor }}
                      ></div>
                      <span className="font-mono text-sm">{gradient.endColor}</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSS Code:
                    </label>
                    <div className="bg-gray-100 rounded p-3 font-mono text-sm">
                      background: linear-gradient(135deg, {gradient.startColor}, {gradient.endColor});
                    </div>
                    <button
                      onClick={copyGradientCSS}
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Copy CSS</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Upload an image to see the gradient</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden canvas for color processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default function Home() {
  return <ImageGradientGenerator />
}
