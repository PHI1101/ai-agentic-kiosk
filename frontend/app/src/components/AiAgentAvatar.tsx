import React from 'react';
import { Avatar, Box, keyframes } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AiAgentAvatarProps {
  status: AgentStatus;
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); }
  100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
`;

const AiAgentAvatar: React.FC<AiAgentAvatarProps> = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'listening':
        return {
          animation: `${pulse} 2s infinite`,
          backgroundColor: 'primary.light',
        };
      case 'thinking':
        return { backgroundColor: 'secondary.light' }; // Add a thinking animation/style later
      case 'speaking':
        return { transform: 'scale(1.1)' };
      default: // idle
        return { backgroundColor: 'grey.400' };
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
      <Avatar
        sx={{
          width: 64,
          height: 64,
          transition: 'all 0.3s ease',
          ...getStatusStyle(),
        }}
      >
        <SmartToyIcon fontSize="large" />
      </Avatar>
    </Box>
  );
};

export default AiAgentAvatar;
