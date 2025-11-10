import React from 'react';
import { Box, Modal, IconButton } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { keyframes } from '@emotion/react';

// Define the blinking animation
const blink = keyframes`
  50% {
    opacity: 0.5;
  }
`;

interface VoiceInputIndicatorProps {
  listening: boolean;
  onStop: () => void;
}

const VoiceInputIndicator: React.FC<VoiceInputIndicatorProps> = ({ listening, onStop }) => {
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
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 200,
          height: 200,
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          animation: `${blink} 1.2s infinite ease-in-out`,
        }}
      >
        <MicIcon sx={{ color: 'white', fontSize: 100 }} />
        <IconButton
          onClick={onStop}
          sx={{
            position: 'absolute',
            bottom: -80, // Adjusted to place it further below
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          <StopCircleIcon sx={{ fontSize: 40 }} />
        </IconButton>
      </Box>
    </Modal>
  );
};

export default VoiceInputIndicator;
