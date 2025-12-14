import React, { useRef } from 'react';
    import { Label } from '@/components/ui/label';
    import { UploadCloud, Loader2 } from 'lucide-react';

    const FileUpload = ({ onFileChange, fileName, isLoading, isUserLoggedIn, onRequireLogin }) => {
      const fileInputRef = useRef(null);

      const handleInputChange = (event) => {
        const file = event.target.files[0];
        onFileChange(file);
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset file input
        }
      };

      const handleLabelClick = (e) => {
        if (!isUserLoggedIn) {
          e.preventDefault();
          if (onRequireLogin) onRequireLogin();
        }
      };

      return (
        <div>
          <Label htmlFor="file-upload-input-main" className="text-foreground sr-only">Upload STL File</Label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-muted-foreground/50 rounded-md hover:border-primary transition-colors bg-background/50">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="flex text-sm text-muted-foreground justify-center">
                <label
                  htmlFor="file-upload-input-main"
                  className="relative cursor-pointer rounded-md font-medium text-primary hover:text-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary px-2"
                  onClick={handleLabelClick}
                >
                  <span>{fileName || 'Upload an STL file'}</span>
                  <input 
                    id="file-upload-input-main" 
                    name="file-upload-input-main" 
                    type="file" 
                    className="sr-only" 
                    onChange={handleInputChange} 
                    accept=".stl" 
                    ref={fileInputRef}
                  />
                </label>
                {!fileName && <p className="pl-1">or drag and drop</p>}
              </div>
              <p className="text-xs text-muted-foreground">Max file size: 25MB. ASCII or Binary STL.</p>
            </div>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> 
              <p>Loading model...</p>
            </div>
          )}
        </div>
      );
    };

    export default FileUpload;