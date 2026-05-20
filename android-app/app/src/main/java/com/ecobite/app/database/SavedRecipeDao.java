package com.ecobite.app.database;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;

@Dao
public interface SavedRecipeDao {

    @Query("SELECT * FROM saved_recipes ORDER BY savedAt DESC")
    List<SavedRecipeEntity> getAll();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insert(SavedRecipeEntity entity);

    @Query("DELETE FROM saved_recipes WHERE id = :id")
    void deleteById(String id);

    @Query("SELECT COUNT(*) FROM saved_recipes WHERE id = :id")
    int existsById(String id);
}
