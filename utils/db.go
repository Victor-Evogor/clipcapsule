package utils

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

var dbURL = "db/cliphistory.db"

type ClipboardItem struct {
	ID       int
	Content  string
	Position int
}

type Db struct {
	conn *sql.DB
}

// New initializes the database connection and creates the table if it doesn't exist
func (d *Db) New() error {
	db, err := sql.Open("sqlite3", dbURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	d.conn = db

	return d.createTable()
}

// createTable ensures the clipboard_items table exists
func (d *Db) createTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS clipboard_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		content TEXT NOT NULL,
		position INTEGER NOT NULL
	);
	`
	_, err := d.conn.Exec(query)
	return err
}

// UpdateAllItems replaces all clipboard items with the provided ordered texts
func (d *Db) UpdateAllItems(texts []string) error {
	tx, err := d.conn.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Clear existing records
	if _, err := tx.Exec(`DELETE FROM clipboard_items`); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear clipboard_items: %w", err)
	}

	// Insert all new items in order
	stmt, err := tx.Prepare(`INSERT INTO clipboard_items (content, position) VALUES (?, ?)`)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare insert: %w", err)
	}
	defer stmt.Close()

	for i, text := range texts {
		if _, err := stmt.Exec(text, i); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert item %d: %w", i, err)
		}
	}

	return tx.Commit()
}

// Optional: FetchAllItems returns all clipboard items in order
func (d *Db) FetchAllItems() ([]ClipboardItem, error) {
	rows, err := d.conn.Query(`SELECT id, content, position FROM clipboard_items ORDER BY position ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ClipboardItem
	for rows.Next() {
		var item ClipboardItem
		if err := rows.Scan(&item.ID, &item.Content, &item.Position); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

// GetItemByPosition returns a clipboard item based on its position
func (d *Db) GetItemByPosition(position int) (ClipboardItem, error) {
	var item ClipboardItem
	query := `SELECT id, content, position FROM clipboard_items WHERE position = ? LIMIT 1`

	row := d.conn.QueryRow(query, position)
	err := row.Scan(&item.ID, &item.Content, &item.Position)
	if err != nil {
		if err == sql.ErrNoRows {
			return item, fmt.Errorf("no item found at position %d", position)
		}
		return item, fmt.Errorf("failed to get item by position: %w", err)
	}

	return item, nil
}
