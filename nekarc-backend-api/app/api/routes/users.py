from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas.user import PasswordChangeIn, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

VALID_THEMES = {"system", "light", "dark"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.theme is not None:
        if data.theme not in VALID_THEMES:
            raise HTTPException(status_code=400, detail="theme must be system, light, or dark")
        user.theme = data.theme
    if data.full_name is not None:
        user.full_name = data.full_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/password")
def change_password(
    data: PasswordChangeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password updated"}
