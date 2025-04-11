def get_current_user_id(request):
    return request.session.get('user_id')


def get_current_user_role(request):
    return request.session.get('role')


def get_user_departments(request):
    return request.session.get('departments', [])
