import React, { useState, useEffect, useRef } from 'react';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { UploadCloud, Settings2 } from 'lucide-react';
    import ModelViewer from '@/components/custom-print/ModelViewer';
    import FileUpload from '@/components/custom-print/FileUpload';
    import CustomizationOptions from '@/components/custom-print/CustomizationOptions';
    import PriceDisplay from '@/components/custom-print/PriceDisplay';
    import { useToast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';

    const BASE_RATES = {
      pla: 0.00075,
      abs: 0.00090,
      petg: 0.00100,
    };
    const FIXED_CHARGE = 20;
    const MIN_PRICE = 50;

    const CustomPrintPage = () => {
      const [fileName, setFileName] = useState('');
      const [modelUrl, setModelUrl] = useState(null);
      const [modelData, setModelData] = useState(null);
      const [material, setMaterial] = useState('pla');
      const [color, setColor] = useState('#8A2BE2');
      const [infill, setInfill] = useState(20);
      const [price, setPrice] = useState(0);
      const [isLoading, setIsLoading] = useState(false);
      const [modelStats, setModelStats] = useState(null);
      const [materialConfigs, setMaterialConfigs] = useState([]); // [{name, colors: [{name, value}]}]
      const [priceConfigs, setPriceConfigs] = useState([]); // [{name, price}]
      const { toast } = useToast();
      const { user } = useAuth();
      const navigate = useNavigate();

      // Fetch settings from Supabase
      useEffect(() => {
        async function fetchSettings() {
          const { data } = await supabase.from('settings').select('custom_print_materials, custom_print_prices').single();
          if (data) {
            setMaterialConfigs(data.custom_print_materials || []);
            setPriceConfigs(data.custom_print_prices || []);
          } else {
            setMaterialConfigs([
              { name: 'PLA', colors: [ { name: 'Purple', value: '#8A2BE2' } ] },
              { name: 'PETG', colors: [ { name: 'Blue', value: '#00BFFF' } ] },
            ]);
            setPriceConfigs([
              { name: 'PLA', price: 5 },
              { name: 'PETG', price: 7 },
            ]);
          }
        }
        fetchSettings();
      }, []);

      // Material dropdown options
      const materialOptions = Array.isArray(materialConfigs) ? materialConfigs.filter(Boolean).map(mat => ({ value: mat.name, label: mat.name })) : [];
      // Color dropdown options for selected material
      const selectedMaterialObj = Array.isArray(materialConfigs) ? materialConfigs.find(mat => mat && mat.name === material) : undefined;
      const colorOptions = selectedMaterialObj && Array.isArray(selectedMaterialObj.colors) ? selectedMaterialObj.colors.filter(Boolean).map(c => ({ value: c.value, label: c.name })) : [];
      // Get unit price for selected material
      const selectedPriceObj = Array.isArray(priceConfigs) ? priceConfigs.find(p => p && p.name === material) : undefined;
      const unitPrice = selectedPriceObj ? selectedPriceObj.price : 0;

      const handleFileChange = (file) => {
        if (!user) {
          navigate('/auth');
          return;
        }
        if (file) {
          if (file.name.toLowerCase().endsWith('.stl')) {
            setFileName(file.name);
            setIsLoading(true);
            
            const dataUrlReader = new FileReader();
            dataUrlReader.onload = (e) => {
              setModelUrl(e.target.result); 
            };
            dataUrlReader.onerror = () => {
              setIsLoading(false);
              toast({ title: "Error", description: "Error reading file for preview.", variant: "destructive" });
            }
            dataUrlReader.readAsDataURL(file);

            const arrayBufferReader = new FileReader();
            arrayBufferReader.onload = (e) => {
              setModelData(e.target.result);
              setIsLoading(false);
            };
            arrayBufferReader.onerror = () => {
              setIsLoading(false);
              toast({ title: "Error", description: "Error reading file data.", variant: "destructive" });
            }
            arrayBufferReader.readAsArrayBuffer(file);

          } else {
            toast({ title: "Invalid File", description: "Please upload a valid .STL file.", variant: "destructive" });
            setFileName('');
            setModelUrl(null);
            setModelData(null);
          }
        }
      };
      
      const handleViewerError = (errorMessage) => {
        toast({ title: "Viewer Error", description: errorMessage, variant: "destructive" });
        setModelUrl(null); 
        setModelData(null);
        setFileName('');
      };

      const handleSendToQuote = async () => {
        if (!user) {
          navigate('/auth');
          return;
        }
        // Upload STL file to Supabase Storage
        const file = new File([modelData], fileName, { type: 'application/sla' });
        const { data: uploadData, error: uploadError } = await supabase.storage.from('stl-files').upload(`${user.id}/${Date.now()}_${fileName}`, file);
        if (uploadError) {
          toast({ title: 'Upload Error', description: uploadError.message, variant: 'destructive' });
          return;
        }
        const file_url = uploadData?.path || null;
        // Save quote to Supabase DB
        const { error: insertError } = await supabase.from('quotes').insert([
          {
            user_id: user.id,
            file_url,
            file_name: fileName,
            material,
            color,
            infill,
            price,
            created_at: new Date().toISOString(),
          },
        ]);
        if (insertError) {
          toast({ title: 'Save Error', description: insertError.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Quote Sent!', description: 'Your quote has been added to Your Quotes.' });
        navigate('/dashboard/quotes');
      };

      const handleAddToCart = async () => {
        if (!user) {
          navigate('/auth');
          return;
        }
        // Upload STL file to Supabase Storage
        const file = new File([modelData], fileName, { type: 'application/sla' });
        const { data: uploadData, error: uploadError } = await supabase.storage.from('stl-files').upload(`${user.id}/${Date.now()}_${fileName}`, file);
        if (uploadError) {
          toast({ title: 'Upload Error', description: uploadError.message, variant: 'destructive' });
          return;
        }
        const file_url = uploadData?.path || null;
        // Save to cart_items table (not quotes)
        const { error: insertError } = await supabase.from('cart_items').insert([
          {
            user_id: user.id,
            file_url,
            file_name: fileName,
            material,
            color,
            infill,
            price,
            created_at: new Date().toISOString(),
            quantity: 1,
          },
        ]);
        if (insertError) {
          toast({ title: 'Cart Error', description: insertError.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Added to Cart!', description: 'Your item has been added to the cart.' });
        navigate('/cart');
      };

      useEffect(() => {
        if (!modelStats || !modelStats.volume || isNaN(Number(modelStats.volume)) || Number(modelStats.volume) <= 0) {
          setPrice(0);
          return;
        }

        // Pricing constants
        const BASE_CHARGE = 50; // ₹50 per order
        const BBOX_COST_PER_CM3 = 0.2; // ₹0.2 per cm³ (optional)
        const SUPPORT_CHARGE = 20; // Flat ₹20
        // Use admin-configured unit price for selected material
        const selectedPriceObj = Array.isArray(priceConfigs) ? priceConfigs.find(p => p && p.name === material) : undefined;
        const unitPrice = selectedPriceObj ? Number(selectedPriceObj.price) : 1;

        // Model volume in cm³, adjusted for infill
        const volumeCm3 = (Number(modelStats.volume) / 1000) * (Number(infill) / 100);
        // Bounding box volume in cm³
        const bbox = modelStats.dimensions;
        const bboxVolumeCm3 = bbox ? (bbox.x * bbox.y * bbox.z) / 1000 : 0;

        // Calculate price using unitPrice from settings (unitPrice * volumeCm3)
        let calculatedPrice =
          BASE_CHARGE +
          (unitPrice * volumeCm3) +
          (BBOX_COST_PER_CM3 * bboxVolumeCm3) +
          SUPPORT_CHARGE;
        if (calculatedPrice < MIN_PRICE) calculatedPrice = MIN_PRICE;
        setPrice(Number(calculatedPrice.toFixed(2)));
      }, [material, infill, modelStats?.volume, modelStats?.dimensions, priceConfigs]);

      useEffect(() => {
        // If modelData is cleared (e.g., new file upload or error), also clear modelStats
        if (!modelData) {
          setModelStats(null);
        }
      }, [modelData]);

      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="container mx-auto px-2 py-4 sm:px-4 sm:py-8 scale-95 sm:scale-100"
        >
          <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-6 text-center gradient-text">Create Your Custom 3D Print</h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-4 sm:mb-8 text-center max-w-2xl mx-auto">
            Upload your STL file, customize your print, and get an instant price estimate.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-start">
            <Card className="bg-card/70 backdrop-blur-sm shadow-xl border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg sm:text-2xl flex items-center"><UploadCloud className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Upload Your Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <FileUpload 
                  onFileChange={handleFileChange} 
                  fileName={fileName} 
                  isLoading={isLoading} 
                  isUserLoggedIn={!!user}
                  onRequireLogin={() => navigate('/auth')}
                />
                <ModelViewer 
                  modelData={modelData} 
                  modelColor={color} 
                  onError={handleViewerError}
                  onStats={setModelStats}
                />
              </CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-sm shadow-xl border-accent/20 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg sm:text-2xl flex items-center"><Settings2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-accent" />Customize Your Print</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <CustomizationOptions
                  material={material}
                  setMaterial={setMaterial}
                  materials={materialOptions}
                  color={color}
                  setColor={setColor}
                  colors={colorOptions}
                  infill={infill}
                  setInfill={setInfill}
                />
                <PriceDisplay price={price} />
                <div className="flex flex-col gap-2 sm:gap-3">
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
                    disabled={!modelUrl || !modelData || !user}
                    onClick={handleAddToCart}
                  >
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10 transition-opacity"
                    disabled={!modelUrl || !modelData || !user}
                    onClick={handleSendToQuote}
                  >
                    Send for Quote
                  </Button>
                </div>
                {!user && (
                  <div className="text-center text-red-500 text-xs sm:text-sm mt-2">Please log in to upload files or get a quote.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      );
    };

    export default CustomPrintPage;