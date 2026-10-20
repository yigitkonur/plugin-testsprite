package mcpkit

import (
	"net/http"
	"testing"
)

// The only HTTP listener lives in a test.
func TestOverHTTP(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {})
	go http.ListenAndServe("127.0.0.1:0", mux)
}
