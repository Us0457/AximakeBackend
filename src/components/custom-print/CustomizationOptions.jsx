import React from 'react';
    import { Label } from '@/components/ui/label';
    import { Slider } from '@/components/ui/slider';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Palette, Layers, Settings2 as SettingsIcon, Star } from 'lucide-react';
    import { Link } from 'react-router-dom';

    const CustomizationOptions = ({
      material,
      setMaterial,
      materials,
      color,
      setColor,
      colors,
      infill,
      setInfill,
      printQuality,
      setPrintQuality,
    }) => {
      return (
        <>
          <div>
            <Label htmlFor="material-select" className="text-foreground flex items-center mb-1">
              <Layers className="mr-2 h-4 w-4 text-primary" />Material
            </Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger id="material-select" className="w-full bg-background/70">
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map(mat => (
                  <SelectItem key={mat.value} value={mat.value}>{mat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color-select" className="text-foreground flex items-center mb-1">
              <Palette className="mr-2 h-4 w-4 text-primary" />Color
            </Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger id="color-select" className="w-full bg-background/70" disabled={!colors || colors.length===0}>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {colors.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center">
                      <span className="w-4 h-4 rounded-full mr-2 border border-border" style={{ backgroundColor: c.value }}></span>
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quality-select" className="text-foreground flex items-center mb-1">
              <Star className="mr-2 h-4 w-4 text-primary" />Print Quality
            </Label>
            <Select value={printQuality} onValueChange={setPrintQuality}>
              <SelectTrigger id="quality-select" className="w-full bg-background/70" disabled={!material}>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard (Recommended)">Standard (Recommended)</SelectItem>
                <SelectItem value="High Quality">High Quality</SelectItem>
                <SelectItem value="Ultra Fine">Ultra Fine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="infill-slider" className="text-foreground flex items-center mb-1">
              <SettingsIcon className="mr-2 h-4 w-4 text-primary" />Infill Percentage ({infill}%)
            </Label>
            <Slider
              id="infill-slider"
              defaultValue={[infill]}
              max={100}
              step={5}
              onValueChange={(value) => setInfill(value[0])}
              className="mt-2"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <Link to="/infill-info" className="text-primary hover:underline">Not sure about infill? Learn more</Link>
            </div>
          </div>
        </>
      );
    };

    export default CustomizationOptions;