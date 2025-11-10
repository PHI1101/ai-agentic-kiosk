import React from 'react';
import { Box, Modal } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { keyframes } from '@emotion/react';

// Define the blinking animation
const blink = keyframes`
  50% {
    opacity: 0.5;
  }
`;

interface VoiceInputIndicatorProps {
  listening: boolean;
}

const VoiceInputIndicator: React.FC<VoiceInputIndicatorProps> = ({ listening }) => {
  return (
    <Modal
      open={listening}
      aria-labelledby="voice-input-indicator"
      aria-describedby="indicates that the application is currently listening for voice input"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 150,
          height: 150,
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          animation: `${blink} 1s infinite`,
        }}
      >
        <MicIcon sx={{ color: 'white', fontSize: 80 }} />
      </Box>
    </Modal>
  );
};

export default VoiceInputIndicator;
