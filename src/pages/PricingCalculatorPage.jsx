import React from 'react';
    import { motion } from 'framer-motion';
    import { Slider } from '@/components/ui/slider';
    import { Label } from '@/components/ui/label';
    import { Button } from '@/components/ui/button';

    const PricingCalculatorPage = () => {
      const [material, setMaterial] = React.useState(50);
      const [size, setSize] = React.useState(50);
      const [printTime, setPrintTime] = React.useState(50);
      const [price, setPrice] = React.useState(0);

      React.useEffect(() => {
        const basePrice = 10;
        const materialCost = (material / 100) * 50; 
        const sizeCost = (size / 100) * 30;
        const timeCost = (printTime / 100) * 20;
        setPrice(basePrice + materialCost + sizeCost + timeCost);
      }, [material, size, printTime]);

      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-8"
        >
          <h1 className="text-4xl font-bold mb-8 gradient-text">Real-Time Pricing Calculator</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Estimate the cost of your 3D print. Adjust the sliders to see how material, size, and print time affect the price. This is a simplified calculator for demonstration.
          </p>
          <div className="max-w-md mx-auto space-y-8 bg-card/50 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-primary/20">
            <div>
              <Label htmlFor="material-slider" className="text-foreground">Material Complexity/Cost (0-100)</Label>
              <Slider
                id="material-slider"
                defaultValue={[material]}
                max={100}
                step={1}
                onValueChange={(value) => setMaterial(value[0])}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">Current value: {material}</p>
            </div>
            <div>
              <Label htmlFor="size-slider" className="text-foreground">Object Size/Volume (0-100)</Label>
              <Slider
                id="size-slider"
                defaultValue={[size]}
                max={100}
                step={1}
                onValueChange={(value) => setSize(value[0])}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">Current value: {size}</p>
            </div>
            <div>
              <Label htmlFor="time-slider" className="text-foreground">Estimated Print Time (0-100)</Label>
              <Slider
                id="time-slider"
                defaultValue={[printTime]}
                max={100}
                step={1}
                onValueChange={(value) => setPrintTime(value[0])}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">Current value: {printTime}</p>
            </div>
            <div className="text-center pt-4 border-t border-border">
              <p className="text-lg text-muted-foreground">Estimated Price:</p>
              <p className="text-3xl font-bold gradient-text">${price.toFixed(2)}</p>
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity">
              Request This Print (Coming Soon)
            </Button>
          </div>
        </motion.div>
      );
    };

    export default PricingCalculatorPage;