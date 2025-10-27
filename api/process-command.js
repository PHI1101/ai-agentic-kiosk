export default (req, res) => {
  res.status(200).json({
    message: 'Function was reached.',
    method: req.method,
    headers: req.headers,
    body: req.body, // Also log the body to see if it's being parsed
  });
};
