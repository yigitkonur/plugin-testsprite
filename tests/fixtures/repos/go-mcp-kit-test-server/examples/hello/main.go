package main

import "net/http"

func main() {
	http.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {})
	http.ListenAndServe(":8080", nil)
}
