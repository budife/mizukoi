import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PixelArtAnimation } from "@/components/pixel-art-animation";

export function ComingSoon() {
  const [isComingSoon, setIsComingSoon] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="coming-soon">
      <div className="coming-soon__stage">
        <div className="coming-soon__pixel-art">
          <PixelArtAnimation />
        </div>
        <div className="coming-soon__content">
          <header className="coming-soon__header">
            <div className="brand-float coming-soon">
              <h1 className="brand-wordmark coming-soon">MIZUKOI</h1>
            </div>
            <div className="coming-soon__badge">
              <span className="coming-soon__text">COMING SOON</span>
            </div>
          </header>

          <div className="coming-soon__title">
            <h2 className="coming-soon__title-text">Interactive Koi Pond</h2>
            <p className="coming-soon__subtitle">
              A living, breathing koi pond experience with ambient sound and dynamic weather.
            </p>
          </div>

          <div className="coming-soon__features">
            <div className="coming-soon__feature">
              <div className="coming-soon__feature-icon">{/* pixel art koi */}</div>
              <p>Real-time koi school simulation</p>
            </div>
            <div className="coming-soon__feature">
              <div className="coming-soon__feature-icon">{/* pixel art weather */}</div>
              <p>Dynamic weather: sunny, rain, mist, fog</p>
            </div>
            <div className="coming-soon__feature">
              <div className="coming-soon__feature-icon">{/* pixel art sound */}</div>
              <p>Ambient sound with adjustable volume</p>
            </div>
            <div className="coming-soon__feature">
              <div className="coming-soon__feature-icon">{/* pixel art animation */}</div>
              <p>Smooth frame rate control</p>
            </div>
          </div>

          <div className="coming-soon__footer">
            <Button
              variant="default"
              onClick={() => setIsComingSoon(false)}
              className="coming-soon__enter-btn"
            >
              <Settings className="coming-soon__enter-icon" />
              Enter Pond
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Drawer */}
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen} modal={false}>
        <DrawerTrigger className="coming-soon__settings-btn" aria-label="Open settings">
          <Settings />
        </DrawerTrigger>
        <DrawerContent className="settings-drawer">
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>
          <div className="settings-quick">
            <div className="settings-quick__section">
              <div className="settings-quick__heading">
                <h3>Coming Soon Mode</h3>
                <p>Toggle between Coming Soon and Pond modes</p>
              </div>
              <Switch
                checked={isComingSoon}
                onCheckedChange={setIsComingSoon}
                className="settings-quick__switch"
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
