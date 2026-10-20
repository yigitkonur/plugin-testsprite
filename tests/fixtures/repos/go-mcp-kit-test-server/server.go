package mcpkit

// Server is the library's MCP server type. It does not listen on a port itself.
type Server struct{ Name string }

func (s *Server) Handle(method string) string { return s.Name + ":" + method }
