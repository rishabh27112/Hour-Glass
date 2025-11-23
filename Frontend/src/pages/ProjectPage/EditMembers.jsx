import React, { useState } from 'react';
import PropTypes from 'prop-types';

function EditMembers({ project, onAdd, currentMode, setCurrentMode, onOpenAddDialog }) {
  const [showMenu, setShowMenu] = useState(false);
  // EditMembers now only provides the menu and delete flow; add-dialog handled centrally

  const toggleMenu = () => setShowMenu((s) => !s);

  const selectAdd = () => {
    // open centralized add dialog in parent
    if (typeof onOpenAddDialog === 'function') onOpenAddDialog();
    setShowMenu(false);
  };

  const selectDelete = () => {
    setCurrentMode('delete');
    setShowMenu(false);
  };

  const doneEditing = () => {
    setCurrentMode(null);
  };

  // search/add handled by parent dialog now

  return (
    <div className={styles.editContainer}>
      <button className={styles.threeDot} onClick={toggleMenu}>⋮</button>
      {showMenu && (
        <div className={styles.dropdown}>
          <button onClick={selectAdd}>Add Member</button>
          <button onClick={selectDelete}>Delete Members</button>
        </div>
      )}

      {/* Add-panel removed: Add actions are handled via centralized dialog opened by onOpenAddDialog */}

      {currentMode === 'delete' && (
        <div className={styles.deletePanel}>
          <p>Click the minus buttons to remove members.</p>
          <button className={styles.doneButton} onClick={doneEditing}>Done</button>
        </div>
      )}
    </div>
  );
}

EditMembers.propTypes = {
  project: PropTypes.object,
  onAdd: PropTypes.func.isRequired,
  currentMode: PropTypes.string,
  setCurrentMode: PropTypes.func.isRequired,
  onOpenAddDialog: PropTypes.func.isRequired,
};

export default EditMembers;
