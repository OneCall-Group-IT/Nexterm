const { listDrives } = require('../services/smbDriveService');

router.get(
  '/api/servers/:serverId/files/drives',
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const userId = req.user.id;

      const { protocol, smbConfig } = await resolveFileTransport(serverId, userId);

      if (protocol !== 'smb') {
        return res.status(400).json({ error: 'Drives available only on SMB/Windows hosts' });
      }

      const drives = await listDrives(smbConfig);
      return res.json({ drives });
    } catch (err) {
      console.error('Drive listing failed:', err);
      return res.status(500).json({ error: 'Failed to list drives' });
    }
  }
);