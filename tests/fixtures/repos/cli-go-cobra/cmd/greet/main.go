package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:  "greet [name]",
		Args: cobra.ExactArgs(1),
		Run:  func(_ *cobra.Command, args []string) { fmt.Printf("Hello, %s!\n", args[0]) },
	}
	_ = root.Execute()
}
