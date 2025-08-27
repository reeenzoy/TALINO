app.post('/api/app/conversations', requireAuth, async (req, res) => { /* create */ });
app.get('/api/app/conversations', requireAuth, async (req, res) => { /* list */ });
app.get('/api/app/conversations/:id/messages', requireAuth, async (req, res) => { /* get messages */ });
app.post('/api/app/conversations/:id/messages', requireAuth, async (req, res) => { /* append */ });
app.patch('/api/app/conversations/:id', requireAuth, async (req, res) => { /* rename */ });
app.delete('/api/app/conversations/:id', requireAuth, async (req, res) => { /* delete */ });

// List conversations for the current user (Express + Prisma)
app.get('/api/app/conversations', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    res.json({ items: rows });
  } catch (e) {
    console.error('List conversations error:', e);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});